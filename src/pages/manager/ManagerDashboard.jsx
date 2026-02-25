import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import {
    Box, Typography, Card, CardContent, Grid, Fade, Chip, Avatar, Button, Divider,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Snackbar, Alert, List, ListItem, ListItemAvatar, ListItemText, Checkbox,
    ListItemButton, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
    Groups as GroupsIcon, People as PeopleIcon, EventNote as EventIcon,
    Edit as EditIcon, Visibility, Assignment
} from '@mui/icons-material';

export default function ManagerDashboard() {
    const { userModel } = useAuth();
    const location = useLocation();
    const [division, setDivision] = useState(null);
    const [players, setPlayers] = useState([]);
    const [attendanceCount, setAttendanceCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userModel?.assignedDivisionId) {
            setLoading(false);
            return;
        }

        const unsubs = [];
        // Division
        unsubs.push(onSnapshot(doc(db, 'divisions', userModel.assignedDivisionId), snap => {
            if (snap.exists()) {
                setDivision(divisionModelFromMap({ ...snap.data(), id: snap.id }));
            } else {
                setDivision(null);
            }
            setLoading(false);
        }));

        // Players
        unsubs.push(onSnapshot(query(collection(db, 'players'), where('divisionId', '==', userModel.assignedDivisionId)), snap => {
            setPlayers(snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name)));
        }));

        // Attendance
        unsubs.push(onSnapshot(query(collection(db, 'attendance'), where('divisionId', '==', userModel.assignedDivisionId)), snap => {
            setAttendanceCount(snap.size);
        }));

        return () => unsubs.forEach(u => u());
    }, [userModel]);

    if (loading) return null;

    if (!division) {
        return (
            <Fade in timeout={400}>
                <Box>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h4" fontWeight={800}>
                            ¡Hola, {userModel?.name?.split(' ')[0]}! 📋
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Panel de Manager
                        </Typography>
                    </Box>
                    <Card><CardContent><Typography color="text.secondary">No tenés una división asignada.</Typography></CardContent></Card>
                </Box>
            </Fade>
        );
    }

    return (
        <Routes>
            <Route path="/*" element={<ManagerOverview division={division} players={players} attendanceCount={attendanceCount} />} />
            <Route path="/players" element={<ManagerPlayers division={division} players={players} />} />
        </Routes>
    );
}

// ─── Sub-page: Overview ──────────────────────────────────────────────
function ManagerOverview({ division, players, attendanceCount }) {
    const { userModel } = useAuth();
    const navigate = useNavigate();
    const [editDiv, setEditDiv] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" fontWeight={800}>
                        ¡Hola, {userModel?.name?.split(' ')[0]}! 📋
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Panel de Manager
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={<Assignment />} onClick={() => navigate('/manager/history')}>
                        Ver Historial de Asistencias
                    </Button>
                </Box>

                <Card sx={{ mb: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}><GroupsIcon /></Avatar>
                                <Box>
                                    <Typography variant="h5" fontWeight={700}>{division.name}</Typography>
                                    <Chip label={`Año ${division.year}`} size="small" variant="outlined" />
                                </Box>
                            </Box>
                            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditDiv(true)}>
                                Editar Nombre
                            </Button>
                        </Box>
                    </CardContent>
                </Card>

                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6}>
                        <Card sx={{ background: 'linear-gradient(135deg, #1B5E2015 0%, #1B5E2008 100%)' }}>
                            <CardContent sx={{ p: 3, textAlign: 'center' }}>
                                <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                                <Typography variant="h3" fontWeight={800} color="primary.main">{players.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Jugadores</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Card sx={{ background: 'linear-gradient(135deg, #1565C015 0%, #1565C008 100%)' }}>
                            <CardContent sx={{ p: 3, textAlign: 'center' }}>
                                <EventIcon sx={{ fontSize: 40, color: '#1565C0', mb: 1 }} />
                                <Typography variant="h3" fontWeight={800} color="#1565C0">{attendanceCount}</Typography>
                                <Typography variant="body2" color="text.secondary">Asistencias</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Dialogs */}
                {editDiv && (
                    <ManagerEditDivisionDialog
                        division={division}
                        onClose={() => setEditDiv(false)}
                        onSuccess={() => { setEditDiv(false); setSnack({ open: true, msg: 'División actualizada', severity: 'success' }); }}
                    />
                )}

                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}

// ─── Sub-page: Players ───────────────────────────────────────────────
function ManagerPlayers({ division, players }) {
    const [viewPlayer, setViewPlayer] = useState(null);
    const [editPlayer, setEditPlayer] = useState(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" fontWeight={800}>Jugadores de {division.name}</Typography>
                    <Typography variant="body1" color="text.secondary">Gestioná los jugadores de tu división</Typography>
                </Box>

                <Card>
                    <CardContent>
                        {players.length === 0 ? (
                            <Typography color="text.secondary" sx={{ mt: 1 }}>No hay jugadores registrados.</Typography>
                        ) : (
                            <List disablePadding>
                                {players.map((p, i) => (
                                    <Box key={p.id}>
                                        {i > 0 && <Divider />}
                                        <ListItem sx={{ py: 1.5, px: 1 }}>
                                            <ListItemAvatar>
                                                <Avatar sx={{ bgcolor: 'primary.main' }}>{p.name?.[0]?.toUpperCase()}</Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={<Typography fontWeight={600}>{p.name}</Typography>}
                                                secondary={`DNI: ${p.dni || '-'}`}
                                            />
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Tooltip title="Ver Perfil">
                                                    <IconButton size="small" color="info" onClick={() => setViewPlayer(p)}>
                                                        <Visibility fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Editar Jugador">
                                                    <IconButton size="small" onClick={() => setEditPlayer(p)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </ListItem>
                                    </Box>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>

                {viewPlayer && (
                    <ManagerPlayerProfileDialog
                        player={viewPlayer}
                        division={division}
                        onClose={() => setViewPlayer(null)}
                    />
                )}

                {editPlayer && (
                    <ManagerEditPlayerDialog
                        player={editPlayer}
                        division={division}
                        onClose={() => setEditPlayer(null)}
                        onSuccess={() => { setEditPlayer(null); setSnack({ open: true, msg: 'Jugador actualizado', severity: 'success' }); }}
                    />
                )}

                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}

// ─── Manager Edit Division Dialog (Only Name) ──────────────────────
function ManagerEditDivisionDialog({ division, onClose, onSuccess }) {
    const [name, setName] = useState(division.name);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'divisions', division.id), { name: name.trim() });
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar División</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre (ej: M-10)" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} autoFocus />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Como manager, sólo podés modificar el nombre de tu división asignada.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Manager Player Profile Dialog (View Only) ───────────────────
function ManagerPlayerProfileDialog({ player, division, onClose }) {
    const currentYear = new Date().getFullYear();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const payments = player.clubFeePayments || {};
    const paidYears = player.paidPlayerRightsYears || [];
    const calcAge = (bd) => { if (!bd) return '-'; const d = bd instanceof Date ? bd : new Date(bd); return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000)); };
    const formatDate = (bd) => { if (!bd) return '-'; const d = bd instanceof Date ? bd : new Date(bd); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontSize: 20 }}>{player.name?.[0]?.toUpperCase()}</Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>{player.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{division?.name} ({division?.year})</Typography>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>Datos Personales</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Box><Typography variant="caption" color="text.secondary">DNI</Typography><Typography variant="body2" fontWeight={500}>{player.dni || '-'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Email</Typography><Typography variant="body2" fontWeight={500}>{player.email || '-'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Teléfono</Typography><Typography variant="body2" fontWeight={500}>{player.phone || '-'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Fecha de Nacimiento</Typography><Typography variant="body2" fontWeight={500}>{formatDate(player.birthDate)} ({calcAge(player.birthDate)} años)</Typography></Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Cuotas del Club — {currentYear}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                    {months.map((m, i) => {
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`; const paid = !!payments[key]; return (
                            <Chip key={key} label={m.substring(0, 3)} size="small" color={paid ? 'success' : 'default'} variant={paid ? 'filled' : 'outlined'}
                                icon={paid ? <span style={{ fontSize: 12 }}>✓</span> : undefined} sx={{ justifyContent: 'center' }} />
                        );
                    })}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Pagadas: {months.filter((_, i) => payments[`${currentYear}-${String(i + 1).padStart(2, '0')}`]).length} / 12
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Derecho de Jugador</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                        <Chip key={y} label={y} size="small" color={paidYears.includes(y) ? 'success' : 'default'} variant={paidYears.includes(y) ? 'filled' : 'outlined'}
                            icon={paidYears.includes(y) ? <span style={{ fontSize: 12 }}>✓</span> : undefined} />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions><Button onClick={onClose} variant="outlined">Cerrar</Button></DialogActions>
        </Dialog>
    );
}

// ─── Manager Edit Player Dialog ────────────────────────────────────
function ManagerEditPlayerDialog({ player, division, onClose, onSuccess }) {
    const [name, setName] = useState(player.name);
    const [dni, setDni] = useState(player.dni || '');
    const [birthDate, setBirthDate] = useState(player.birthDate ? (player.birthDate instanceof Date ? player.birthDate : new Date(player.birthDate)).toISOString().split('T')[0] : '');
    const [clubFeePayments, setClubFeePayments] = useState({ ...player.clubFeePayments });
    const [paidYears, setPaidYears] = useState([...(player.paidPlayerRightsYears || [])]);
    const [loading, setLoading] = useState(false);
    const currentYear = new Date().getFullYear();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const data = { name: name.trim(), dni: dni.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null, clubFeePayments, paidPlayerRightsYears: paidYears };
            await updateDoc(doc(db, 'players', player.id), data);
            if (player.userId) {
                try { await updateDoc(doc(db, 'users', player.userId), { name: name.trim(), dni: dni.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null }); } catch (e) { console.log('Linked user update error:', e); }
            }
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar Jugador</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="DNI" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />

                <FormControl fullWidth sx={{ mt: 2 }} disabled>
                    <InputLabel>División</InputLabel>
                    <Select value={division.id} label="División">
                        <MenuItem value={division.id}>{division.name} ({division.year})</MenuItem>
                    </Select>
                </FormControl>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Cuotas del Club ({currentYear})</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {months.map((m, i) => {
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`; return (
                            <Chip key={key} label={m} size="small" color={clubFeePayments[key] ? 'success' : 'default'} variant={clubFeePayments[key] ? 'filled' : 'outlined'}
                                onClick={() => setClubFeePayments(prev => ({ ...prev, [key]: !prev[key] }))} sx={{ cursor: 'pointer' }} />
                        );
                    })}
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>Derechos de Jugador (Anual)</Typography>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <ListItemButton key={y} dense onClick={() => setPaidYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])} sx={{ p: 0 }}>
                        <Checkbox checked={paidYears.includes(y)} size="small" />
                        <ListItemText primary={`Año ${y}`} />
                    </ListItemButton>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
        </Dialog>
    );
}
