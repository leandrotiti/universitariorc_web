import { useState, useEffect, useMemo } from 'react';
import {
    Box, Card, CardContent, Typography, Button, FormControl, InputLabel, Select, MenuItem,
    Chip, Checkbox, FormControlLabel, TextField, CircularProgress, Divider
} from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { userModelFromMap, RoleLabels } from '../../models/UserModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import * as XLSX from 'xlsx';

export default function ReportsPage({ allowedDivisionIds = null }) {
    const [reportType, setReportType] = useState('General');
    const [divisionFilter, setDivisionFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [divisions, setDivisions] = useState([]);
    const [exporting, setExporting] = useState(false);
    const [exportFields, setExportFields] = useState({
        Nombre: true, DNI: true, Email: true, Rol: true, División: true,
        'Derecho Jugador': true, 'Cuotas al día': true, Asistencias: false,
    });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'divisions'), snap => {
            let divs = snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })).filter(d => !d.isHidden);
            if (allowedDivisionIds) divs = divs.filter(d => allowedDivisionIds.includes(d.id));
            setDivisions(divs);
        });
        return unsub;
    }, []);

    const toggleField = (field) => setExportFields(prev => ({ ...prev, [field]: !prev[field] }));

    const handleExport = async () => {
        setExporting(true);
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            let users = usersSnap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id }));
            if (roleFilter) users = users.filter(u => u.roles.includes(roleFilter));
            if (divisionFilter) users = users.filter(u => u.assignedDivisionId === divisionFilter);

            const playersSnap = await getDocs(collection(db, 'players'));
            let players = playersSnap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id }));
            if (divisionFilter) players = players.filter(p => p.divisionId === divisionFilter);
            else if (allowedDivisionIds) players = players.filter(p => allowedDivisionIds.includes(p.divisionId));
            if (roleFilter && roleFilter !== 'player') players = [];

            const divMap = Object.fromEntries(divisions.map(d => [d.id, d.name]));
            const currentYear = new Date().getFullYear();

            let divisionTotalClasses = {};
            let playerAttendanceCount = {};
            let playerNotes = {};
            let allSessions = [];
            const needsAttendance = exportFields.Asistencias || reportType === 'Asistencia Detallada';
            const validDivisionIds = divisionFilter ? [divisionFilter] : divisions.map(d => d.id);

            if (needsAttendance && validDivisionIds.length > 0) {
                const attendanceSnap = await getDocs(collection(db, 'attendance'));
                for (const docSnap of attendanceSnap.docs) {
                    const data = docSnap.data();
                    if (!data.date || !validDivisionIds.includes(data.divisionId)) continue;
                    const attDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    if (startDate && attDate < new Date(startDate)) continue;
                    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59); if (attDate > end) continue; }
                    const divId = data.divisionId;
                    const normalizedDate = `${String(attDate.getDate()).padStart(2, '0')}/${String(attDate.getMonth() + 1).padStart(2, '0')}/${attDate.getFullYear()}`;
                    divisionTotalClasses[divId] = (divisionTotalClasses[divId] || 0) + 1;

                    let combinedNotes = data.notes ? `${data.notes} ` : '';
                    if (data.observations && data.observations.length > 0) {
                        combinedNotes += data.observations.map(o => `[${o.authorName}]: ${o.text}`).join(' | ');
                    }
                    combinedNotes = combinedNotes.trim();

                    const presentIds = data.presentPlayerIds || [];
                    const lateIds = data.latePlayerIds || [];
                    [...presentIds, ...lateIds].forEach(pid => {
                        playerAttendanceCount[pid] = (playerAttendanceCount[pid] || 0) + 1;
                        if (combinedNotes) {
                            if (!playerNotes[pid]) playerNotes[pid] = [];
                            playerNotes[pid].push(`${normalizedDate}: ${combinedNotes}`);
                        }
                    });
                    allSessions.push({ ...data, date: attDate, normalizedDate, _combinedNotes: combinedNotes });
                }
                allSessions.sort((a, b) => a.date - b.date);
            }

            let sheetData = [];

            if (reportType === 'Asistencia Detallada') {
                sheetData.push(['Fecha', 'Tipo', 'Observaciones', 'Jugador', 'DNI', 'Asistencia', 'División']);
                for (const session of allSessions) {
                    const sessionDiv = divMap[session.divisionId] || '';
                    const sessionDate = session.normalizedDate;
                    const sessionType = session.type === 'training' ? 'Entrenamiento' : session.type === 'match' ? 'Partido' : session.type;
                    sheetData.push([sessionDate, sessionType, session._combinedNotes || '', '', '', '', sessionDiv]);
                    const divPlayers = players.filter(p => p.divisionId === session.divisionId);
                    for (const p of divPlayers) {
                        let status = 'Ausente';
                        if ((session.presentPlayerIds || []).includes(p.id)) status = 'Presente';
                        else if ((session.latePlayerIds || []).includes(p.id)) status = 'Tarde';
                        sheetData.push(['', '', '', p.name, p.dni, status, '']);
                    }
                }
            } else {
                const headers = Object.entries(exportFields).filter(([, v]) => v).map(([k]) => k);
                if (exportFields.Asistencias) headers.push('Observaciones');
                sheetData.push(headers);

                const processedPlayerIds = new Set();
                for (const u of users) {
                    const linkedPlayer = players.find(p => p.userId === u.id) || players.find(p => p.dni && p.dni === u.dni);
                    if (linkedPlayer) processedPlayerIds.add(linkedPlayer.id);
                    const divId = u.assignedDivisionId || linkedPlayer?.divisionId || '';
                    const divName = divMap[divId] || '';
                    let rightsPaid = 'N/A', feesStatus = 'N/A', attendanceStatus = 'N/A', obsText = '';
                    if (linkedPlayer) {
                        rightsPaid = (linkedPlayer.paidPlayerRightsYears || []).includes(currentYear) ? 'Sí' : 'No';
                        const payments = linkedPlayer.clubFeePayments || {};
                        const paidCount = Object.values(payments).filter(v => v).length;
                        feesStatus = `${paidCount}/12`;
                        if (exportFields.Asistencias && divId) {
                            const total = divisionTotalClasses[divId] || 0;
                            const attended = playerAttendanceCount[linkedPlayer.id] || 0;
                            attendanceStatus = total > 0 ? `${attended}/${total} (${Math.round(attended / total * 100)}%)` : '0/0';
                            obsText = (playerNotes[linkedPlayer.id] || []).join(' | ');
                        }
                    }
                    const row = [];
                    if (exportFields.Nombre) row.push(u.name);
                    if (exportFields.DNI) row.push(u.dni || linkedPlayer?.dni || '');
                    if (exportFields.Email) row.push(u.email);
                    if (exportFields.Rol) row.push(u.roles.map(r => RoleLabels[r]).join(', '));
                    if (exportFields.División) row.push(divName);
                    if (exportFields['Derecho Jugador']) row.push(rightsPaid);
                    if (exportFields['Cuotas al día']) row.push(feesStatus);
                    if (exportFields.Asistencias) { row.push(attendanceStatus); row.push(obsText); }
                    sheetData.push(row);
                }
                for (const p of players) {
                    if (processedPlayerIds.has(p.id)) continue;
                    const divName = divMap[p.divisionId] || '';
                    const rightsPaid = (p.paidPlayerRightsYears || []).includes(currentYear) ? 'Sí' : 'No';
                    const payments = p.clubFeePayments || {};
                    const feesStatus = `${Object.values(payments).filter(v => v).length}/12`;
                    let attendanceStatus = 'N/A', obsText = '';
                    if (exportFields.Asistencias) {
                        const total = divisionTotalClasses[p.divisionId] || 0;
                        const attended = playerAttendanceCount[p.id] || 0;
                        attendanceStatus = total > 0 ? `${attended}/${total} (${Math.round(attended / total * 100)}%)` : '0/0';
                        obsText = (playerNotes[p.id] || []).join(' | ');
                    }
                    const row = [];
                    if (exportFields.Nombre) row.push(p.name);
                    if (exportFields.DNI) row.push(p.dni);
                    if (exportFields.Email) row.push(p.email || '');
                    if (exportFields.Rol) row.push('Jugador');
                    if (exportFields.División) row.push(divName);
                    if (exportFields['Derecho Jugador']) row.push(rightsPaid);
                    if (exportFields['Cuotas al día']) row.push(feesStatus);
                    if (exportFields.Asistencias) { row.push(attendanceStatus); row.push(obsText); }
                    sheetData.push(row);
                }
            }

            // Build and download XLSX
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            // Auto column widths
            const colWidths = sheetData[0].map((_, colIdx) => {
                let max = 10;
                sheetData.forEach(row => { const cell = String(row[colIdx] || ''); if (cell.length > max) max = cell.length; });
                return { wch: Math.min(max + 2, 50) };
            });
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, reportType === 'General' ? 'Reporte General' : 'Asistencia Detallada');

            // Generate as ArrayBuffer and download via Blob
            const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const fileName = `reporte_universitario_${new Date().toISOString().split('T')[0]}.xlsx`;
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (e) {
            alert('Error al exportar: ' + e.message);
            console.error(e);
        } finally {
            setExporting(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={800} gutterBottom>Reportes</Typography>
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Filtros</Typography>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Tipo de Reporte</InputLabel>
                        <Select value={reportType} label="Tipo de Reporte" onChange={e => setReportType(e.target.value)}>
                            <MenuItem value="General">Resumen General</MenuItem>
                            <MenuItem value="Asistencia Detallada">Asistencia Detallada por Día</MenuItem>
                        </Select>
                    </FormControl>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel>División</InputLabel>
                            <Select value={divisionFilter} label="División" onChange={e => setDivisionFilter(e.target.value)}>
                                <MenuItem value="">Todas</MenuItem>
                                {divisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Rol</InputLabel>
                            <Select value={roleFilter} label="Rol" onChange={e => setRoleFilter(e.target.value)}>
                                <MenuItem value="">Todos</MenuItem>
                                <MenuItem value="player">Jugador</MenuItem>
                                <MenuItem value="coach">Entrenador</MenuItem>
                                <MenuItem value="parent">Padre/Madre</MenuItem>
                                <MenuItem value="manager">Manager</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom fontWeight={700}>Rango de Fechas (para Asistencias)</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField fullWidth label="Desde" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                        <TextField fullWidth label="Hasta" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                    </Box>
                </CardContent>
            </Card>
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Campos a Exportar</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(exportFields).map(([key, val]) => (
                            <Chip key={key} label={key} color={val ? 'primary' : 'default'} variant={val ? 'filled' : 'outlined'} onClick={() => toggleField(key)} sx={{ cursor: 'pointer' }} />
                        ))}
                    </Box>
                </CardContent>
            </Card>
            <Button fullWidth variant="contained" size="large" startIcon={exporting ? <CircularProgress size={24} color="inherit" /> : <FileDownload />}
                onClick={handleExport} disabled={exporting}
                sx={{ py: 1.5, bgcolor: 'success.dark', '&:hover': { bgcolor: 'success.main' }, fontSize: '1.1rem' }}>
                {exporting ? 'EXPORTANDO...' : 'EXPORTAR EXCEL (.xlsx)'}
            </Button>
        </Box>
    );
}
