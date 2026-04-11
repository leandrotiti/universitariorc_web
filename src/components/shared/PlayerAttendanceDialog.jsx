import { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Typography, Box, CircularProgress, Select, MenuItem,
    FormControl, InputLabel, Avatar, Card, CardContent, Chip
} from '@mui/material';
import { CheckCircle, Cancel, AccessTime, EventNote } from '@mui/icons-material';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function PlayerAttendanceDialog({ player, open, onClose }) {
    const [attendances, setAttendances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('all');

    const currentYear = new Date().getFullYear();

    useEffect(() => {
        if (!open || !player?.divisionId) return;
        setLoading(true);
        const q = query(collection(db, 'attendance'), where('divisionId', '==', player.divisionId));
        const unsub = onSnapshot(q, (snap) => {
            const records = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(data.date)
                };
            }).filter(a => {
                if (a.date.getUTCFullYear() !== currentYear) return false;
                const inPresent = (a.presentPlayerIds || []).includes(player.id);
                const inLate = (a.latePlayerIds || []).includes(player.id);
                const inAbsent = (a.absentPlayerIds || []).includes(player.id);
                return inPresent || inLate || inAbsent;
            }).sort((a, b) => b.date - a.date);
            
            setAttendances(records);
            setLoading(false);
        });
        return unsub;
    }, [open, player]);

    const filtered = useMemo(() => {
        if (selectedMonth === 'all') return attendances;
        return attendances.filter(a => a.date.getUTCMonth() === parseInt(selectedMonth));
    }, [attendances, selectedMonth]);

    const stats = useMemo(() => {
        const total = filtered.length;
        let present = 0, absent = 0, late = 0;
        filtered.forEach(a => {
            if ((a.presentPlayerIds || []).includes(player.id)) present++;
            else if ((a.latePlayerIds || []).includes(player.id)) late++;
            else if ((a.absentPlayerIds || []).includes(player.id)) absent++;
        });
        return { total, present, absent, late };
    }, [filtered, player.id]);

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const getStatusInfo = (record) => {
        if ((record.presentPlayerIds || []).includes(player.id)) return { label: 'Presente', color: 'success', icon: <CheckCircle /> };
        if ((record.latePlayerIds || []).includes(player.id)) return { label: 'Tarde', color: 'warning', icon: <AccessTime /> };
        if ((record.absentPlayerIds || []).includes(player.id)) return { label: 'Ausente', color: 'error', icon: <Cancel /> };
        return null; // Should not happen due to filtering, but safe fallback
    };

    const translateType = (type) => {
        if (type === 'training') return 'Entrenamiento';
        if (type === 'match') return 'Partido';
        return type;
    };

    if (!player) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}><EventNote /></Avatar>
                <Box>
                    <Typography variant="h6" fontWeight={700}>Asistencias {currentYear}</Typography>
                    <Typography variant="body2" color="text.secondary">{player.name}</Typography>
                </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', mb: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Filtrar por Mes</InputLabel>
                        <Select value={selectedMonth} label="Filtrar por Mes" onChange={e => setSelectedMonth(e.target.value)} sx={{ bgcolor: 'background.paper' }}>
                            <MenuItem value="all"><em>Todos los meses</em></MenuItem>
                            {months.map((m, i) => (
                                <MenuItem key={i} value={i}>{m}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
                    <Card sx={{ flex: 1, textAlign: 'center', borderTop: '4px solid #4caf50' }}>
                        <CardContent sx={{ p: '12px !important' }}>
                            <Typography variant="h4" fontWeight={800} color="success.main">{stats.present}</Typography>
                            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>Presente</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1, textAlign: 'center', borderTop: '4px solid #ff9800' }}>
                        <CardContent sx={{ p: '12px !important' }}>
                            <Typography variant="h4" fontWeight={800} color="warning.main">{stats.late}</Typography>
                            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>Tarde</Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1, textAlign: 'center', borderTop: '4px solid #f44336' }}>
                        <CardContent sx={{ p: '12px !important' }}>
                            <Typography variant="h4" fontWeight={800} color="error.main">{stats.absent}</Typography>
                            <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>Ausente</Typography>
                        </CardContent>
                    </Card>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                ) : filtered.length === 0 ? (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                        <Typography color="text.secondary">No hay registros de asistencia en este período.</Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {filtered.map(record => {
                            const status = getStatusInfo(record);
                            if (!status) return null;
                            const dateStr = record.date.toLocaleDateString('es-AR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' });
                            return (
                                <Card key={record.id} variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', bgcolor: `${status.color}.light`, color: `${status.color}.main`, mr: 2 }}>
                                        {status.icon}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'capitalize' }} noWrap>{dateStr}</Typography>
                                        <Typography variant="caption" color="text.secondary">{translateType(record.type)}</Typography>
                                    </Box>
                                    <Chip label={status.label} color={status.color} size="small" sx={{ fontWeight: 600, minWidth: 70 }} />
                                </Card>
                            );
                        })}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="outlined" color="inherit">Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}
