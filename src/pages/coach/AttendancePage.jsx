import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllDivisions, getPlayersByDivision, createAttendance, getAttendanceByDivision } from '../../services/firestoreService';
import {
    Box, Typography, Card, CardContent, Button, FormControl, InputLabel, Select, MenuItem,
    Chip, Avatar, List, ListItem, ListItemAvatar, ListItemText, ToggleButtonGroup, ToggleButton,
    TextField, Snackbar, Alert, Grid, Fade, Divider
} from '@mui/material';
import {
    CheckCircle as PresentIcon, Cancel as AbsentIcon, AccessTime as LateIcon,
    Save as SaveIcon,
} from '@mui/icons-material';

export default function AttendancePage() {
    const { userModel } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const editId = searchParams.get('edit');
    const [editingAttendance, setEditingAttendance] = useState(null);

    const [divisions, setDivisions] = useState([]);
    const [selectedDivision, setSelectedDivision] = useState('');
    const [players, setPlayers] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceType, setAttendanceType] = useState('training');
    const [attendanceMap, setAttendanceMap] = useState({});
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [customTypes, setCustomTypes] = useState([]);

    // Load attendance to edit
    useEffect(() => {
        if (!editId) return;
        async function fetchEdit() {
            setSaving(true);
            try {
                const docSnap = await getDoc(doc(db, 'attendance', editId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setEditingAttendance({ id: docSnap.id, ...data });
                    setSelectedDivision(data.divisionId);
                    const aDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
                    setAttendanceDate(aDate.toISOString().split('T')[0]);
                    setAttendanceType(data.type);
                    setNotes(data.notes || '');
                }
            } catch (e) {
                console.error("Error fetching edit data:", e);
            } finally {
                setSaving(false);
            }
        }
        fetchEdit();
    }, [editId]);

    useEffect(() => {
        async function fetchDivisions() {
            const allDivisions = await getAllDivisions();
            const myDivisions = allDivisions.filter((d) => d.coachIds?.includes(userModel?.id));
            setDivisions(myDivisions);
            if (myDivisions.length > 0 && !editId) {
                // Read divisionId from URL
                const dId = searchParams.get('divisionId') || myDivisions[0].id;
                setSelectedDivision(dId);
                const dObj = myDivisions.find(d => d.id === dId) || myDivisions[0];
                setCustomTypes(dObj.customAttendanceTypes || []);
            } else if (myDivisions.length > 0 && editId) {
                // If editing, selectedDivision is populated from the edit load, but we can set custom types safely
                const dObj = myDivisions.find(d => d.id === selectedDivision);
                setCustomTypes(dObj?.customAttendanceTypes || []);
            }
        }
        if (userModel) fetchDivisions();
    }, [userModel]);

    useEffect(() => {
        async function fetchPlayers() {
            if (!selectedDivision) return;
            const divPlayers = await getPlayersByDivision(selectedDivision);
            setPlayers(divPlayers);
            const initialMap = {};
            if (editingAttendance && editingAttendance.divisionId === selectedDivision) {
                divPlayers.forEach(p => {
                    if (editingAttendance.absentPlayerIds?.includes(p.id)) {
                        initialMap[p.id] = 'absent';
                    } else if (editingAttendance.latePlayerIds?.includes(p.id)) {
                        initialMap[p.id] = 'late';
                    } else {
                        initialMap[p.id] = 'present';
                    }
                });
            } else {
                divPlayers.forEach((p) => { initialMap[p.id] = 'present'; });
            }
            setAttendanceMap(initialMap);

            const div = divisions.find((d) => d.id === selectedDivision);
            setCustomTypes(div?.customAttendanceTypes || []);
        }
        fetchPlayers();
    }, [selectedDivision, divisions, editingAttendance]);

    const handleStatusChange = (playerId, status) => {
        setAttendanceMap((prev) => ({ ...prev, [playerId]: status }));
    };

    const handleMarkAll = (status) => {
        const newMap = {};
        players.forEach((p) => { newMap[p.id] = status; });
        setAttendanceMap(newMap);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Duplicate check
            const existingAttendance = await getAttendanceByDivision(selectedDivision);
            const attDate = new Date(attendanceDate);
            const isDuplicate = existingAttendance.some(a => {
                if (editId && a.id === editId) return false;
                const aDate = a.date instanceof Date ? a.date : new Date(a.date);
                return a.type === attendanceType &&
                    aDate.getFullYear() === attDate.getFullYear() &&
                    aDate.getMonth() === attDate.getMonth() &&
                    aDate.getDate() === attDate.getDate();
            });
            if (isDuplicate) {
                setSnackbar({ open: true, message: `Ya existe una asistencia de tipo "${attendanceType === 'training' ? 'Entrenamiento' : attendanceType === 'match' ? 'Partido' : attendanceType}" para esta fecha.`, severity: 'error' });
                setSaving(false);
                return;
            }

            // Player rights warning for matches
            if (attendanceType === 'match') {
                const currentYear = new Date().getFullYear();
                const unpaidPlayers = players.filter(p =>
                    attendanceMap[p.id] === 'present' &&
                    !(p.paidPlayerRightsYears || []).includes(currentYear)
                );
                if (unpaidPlayers.length > 0) {
                    const names = unpaidPlayers.map(p => p.name).join(', ');
                    setSnackbar({ open: true, message: `ADVERTENCIA: ${names} no tiene(n) el Derecho de Jugador pago.`, severity: 'warning' });
                }
            }

            const presentPlayerIds = Object.entries(attendanceMap).filter(([, s]) => s === 'present').map(([id]) => id);
            const absentPlayerIds = Object.entries(attendanceMap).filter(([, s]) => s === 'absent').map(([id]) => id);
            const latePlayerIds = Object.entries(attendanceMap).filter(([, s]) => s === 'late').map(([id]) => id);

            if (editId) {
                await updateDoc(doc(db, 'attendance', editId), {
                    date: new Date(attendanceDate),
                    divisionId: selectedDivision,
                    type: attendanceType,
                    presentPlayerIds,
                    absentPlayerIds,
                    latePlayerIds,
                    notes: notes || null,
                });
                setSnackbar({ open: true, message: 'Asistencia actualizada correctamente', severity: 'success' });
                setTimeout(() => navigate('/coach/history'), 1500);
            } else {
                await createAttendance({
                    date: new Date(attendanceDate),
                    divisionId: selectedDivision,
                    type: attendanceType,
                    presentPlayerIds,
                    absentPlayerIds,
                    latePlayerIds,
                    notes: notes || null,
                });
                setSnackbar({ open: true, message: 'Asistencia guardada correctamente', severity: 'success' });
                setNotes('');
            }
        } catch (error) {
            console.error('Error saving attendance:', error);
            setSnackbar({ open: true, message: 'Error al guardar asistencia', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const statusColors = {
        present: 'success',
        absent: 'error',
        late: 'warning',
    };

    const statusIcons = {
        present: <PresentIcon fontSize="small" />,
        absent: <AbsentIcon fontSize="small" />,
        late: <LateIcon fontSize="small" />,
    };

    const allTypes = ['training', 'match', ...customTypes];

    return (
        <Fade in timeout={400}>
            <Box>
                <Typography variant="h4" fontWeight={800} gutterBottom>
                    {editId ? 'Editar Asistencia' : 'Tomar Asistencia'}
                </Typography>

                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>División</InputLabel>
                                    <Select value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value)} label="División">
                                        {divisions.map((d) => (
                                            <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField fullWidth size="small" type="date" label="Fecha" value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                    InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Tipo</InputLabel>
                                    <Select value={attendanceType} onChange={(e) => setAttendanceType(e.target.value)} label="Tipo">
                                        <MenuItem value="training">Entrenamiento</MenuItem>
                                        <MenuItem value="match">Partido</MenuItem>
                                        {customTypes.map((t) => (
                                            <MenuItem key={t} value={t}>{t}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" sx={{ alignSelf: 'center', mr: 1 }}>Marcar todos:</Typography>
                    <Chip label="Presentes" color="success" variant="outlined" onClick={() => handleMarkAll('present')} clickable icon={<PresentIcon />} />
                    <Chip label="Ausentes" color="error" variant="outlined" onClick={() => handleMarkAll('absent')} clickable icon={<AbsentIcon />} />
                    <Chip label="Tarde" color="warning" variant="outlined" onClick={() => handleMarkAll('late')} clickable icon={<LateIcon />} />
                </Box>

                {/* Player List */}
                <Card>
                    <List>
                        {players.map((player, idx) => (
                            <Box key={player.id}>
                                {idx > 0 && <Divider />}
                                <ListItem sx={{ py: 1.5 }}>
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: `${statusColors[attendanceMap[player.id]] || 'primary'}.main`, width: 40, height: 40 }}>
                                            {player.name?.charAt(0)?.toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText primary={player.name} secondary={`DNI: ${player.dni}`} />
                                    <ToggleButtonGroup
                                        size="small"
                                        value={attendanceMap[player.id] || 'present'}
                                        exclusive
                                        onChange={(e, val) => val && handleStatusChange(player.id, val)}
                                    >
                                        <ToggleButton value="present" color="success"><PresentIcon fontSize="small" /></ToggleButton>
                                        <ToggleButton value="absent" color="error"><AbsentIcon fontSize="small" /></ToggleButton>
                                        <ToggleButton value="late" color="warning"><LateIcon fontSize="small" /></ToggleButton>
                                    </ToggleButtonGroup>
                                </ListItem>
                            </Box>
                        ))}
                        {players.length === 0 && (
                            <ListItem><ListItemText secondary="No hay jugadores en esta división." /></ListItem>
                        )}
                    </List>
                </Card>

                {/* Notes & Save */}
                <Card sx={{ mt: 2 }}>
                    <CardContent sx={{ p: 2 }}>
                        <TextField fullWidth multiline rows={2} label="Observaciones (opcional)" value={notes}
                            onChange={(e) => setNotes(e.target.value)} size="small" />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
                                disabled={saving || players.length === 0} size="large">
                                {saving ? 'Guardando...' : (editId ? 'Actualizar Asistencia' : 'Guardar Asistencia')}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>

                <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}
