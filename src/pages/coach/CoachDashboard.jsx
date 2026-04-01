import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getDisplayName } from '../../models/UserModel';
import { AddressModel } from '../../models/AddressModel';
import AddressDialog from '../../components/shared/AddressDialog';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import { userModelFromMap, RoleLabels } from '../../models/UserModel';
import {
    Box, Typography, Card, CardContent, Grid, Fade, Chip, Avatar, Button, Divider,
    Accordion, AccordionSummary, AccordionDetails, IconButton, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
    InputLabel, Select, MenuItem, ListItemButton, Checkbox, ListItemText,
    ListItem, ListItemAvatar, Snackbar, Alert, CircularProgress
} from '@mui/material';
import {
    Groups as GroupsIcon, People as PeopleIcon, EventNote as EventIcon,
    AddTask, Assignment, ExpandMore, CalendarMonth, Shield, Edit,
    Visibility, PersonAdd, Add
} from '@mui/icons-material';

export default function CoachDashboard() {
    const { userModel } = useAuth();
    const navigate = useNavigate();
    const [divisions, setDivisions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [editPlayer, setEditPlayer] = useState(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        if (!userModel?.id) return;
        const unsub = onSnapshot(
            query(collection(db, 'divisions'), where('coachIds', 'array-contains', userModel.id)),
            (snap) => {
                const divs = snap.docs
                    .map(d => divisionModelFromMap({ ...d.data(), id: d.id }))
                    .filter(d => !d.isHidden)
                    .sort((a, b) => a.name.localeCompare(b.name));
                setDivisions(divs);
                setLoading(false);

                divs.forEach(div => {
                    onSnapshot(query(collection(db, 'players'), where('divisionId', '==', div.id)), psnap => {
                        setStats(prev => ({ ...prev, [div.id]: { ...prev[div.id], playerCount: psnap.size } }));
                    });
                    onSnapshot(query(collection(db, 'attendance'), where('divisionId', '==', div.id)), asnap => {
                        setStats(prev => ({ ...prev, [div.id]: { ...prev[div.id], attendanceCount: asnap.size } }));
                    });
                });
            }
        );
        return unsub;
    }, [userModel]);

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" fontWeight={800}>
                        ¡Hola, {userModel?.name?.split(' ')[0]}! ⚽
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Panel de Entrenador
                    </Typography>
                </Box>

                {/* Quick Actions */}
                <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={<AddTask />} onClick={() => navigate('/coach/attendance')}>
                        Cargar Asistencias
                    </Button>
                    <Button variant="outlined" startIcon={<Assignment />} onClick={() => navigate('/coach/history')}>
                        Ver Historial
                    </Button>
                </Box>

                <Typography variant="h6" fontWeight={700} gutterBottom>Mis Divisiones</Typography>

                {divisions.map(div => (
                    <Accordion key={div.id} sx={{ mb: 1, '&:before': { display: 'none' }, overflow: 'hidden' }}>
                        <AccordionSummary expandIcon={<ExpandMore />} component="div">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mr: 1 }}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}><Shield fontSize="small" /></Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 600 }}>{div.name} ({div.year})</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {stats[div.id]?.playerCount || 0} jugador(es) · {stats[div.id]?.attendanceCount || 0} asistencias
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }} onClick={e => e.stopPropagation()}>
                                    <Tooltip title="Cargar Asistencia">
                                        <IconButton size="small" color="primary" onClick={() => navigate(`/coach/attendance?divisionId=${div.id}`)}>
                                            <AddTask fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Ver Asistencias">
                                        <IconButton size="small" color="info" onClick={() => navigate(`/coach/attendance-history/${div.id}`)}>
                                            <CalendarMonth fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                            <CoachDivisionPlayerList division={div} onEditPlayer={setEditPlayer} />
                        </AccordionDetails>
                    </Accordion>
                ))}

                {divisions.length === 0 && !loading && (
                    <Card><CardContent><Typography color="text.secondary">No tenés divisiones asignadas.</Typography></CardContent></Card>
                )}

                {editPlayer && <CoachEditPlayerDialog player={editPlayer} divisions={divisions}
                    onClose={() => setEditPlayer(null)}
                    onSuccess={() => { setEditPlayer(null); setSnack({ open: true, msg: 'Jugador actualizado', severity: 'success' }); }} />}

                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}

// ─── Coach Division Player List (view/edit players, no division CRUD) ──
function CoachDivisionPlayerList({ division, onEditPlayer }) {
    const [viewPlayer, setViewPlayer] = useState(null);
    const [players, setPlayers] = useState([]);
    const [coaches, setCoaches] = useState([]);
    const [managers, setManagers] = useState([]);

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(query(collection(db, 'players'), where('divisionId', '==', division.id)), snap => {
            setPlayers(snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name)));
        }));
        if (division.coachIds.length > 0) {
            const ids = division.coachIds.slice(0, 10);
            unsubs.push(onSnapshot(query(collection(db, 'users'), where('__name__', 'in', ids)), snap => {
                setCoaches(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
            }));
        }
        unsubs.push(onSnapshot(query(collection(db, 'users'), where('assignedDivisionId', '==', division.id), where('roles', 'array-contains', 'manager')), snap => {
            setManagers(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
        }));
        return () => unsubs.forEach(u => u());
    }, [division.id, division.coachIds]);

    return (
        <Box>
            {coaches.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Entrenadores ({coaches.length})</Typography>
                    {coaches.map(c => (
                        <ListItem key={c.id} dense>
                            <ListItemAvatar><Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'info.main' }}>{c.name?.[0]?.toUpperCase()}</Avatar></ListItemAvatar>
                            <ListItemText primary={c.name} secondary={c.email} primaryTypographyProps={{ fontSize: 14 }} secondaryTypographyProps={{ fontSize: 12 }} />
                        </ListItem>
                    ))}
                </Box>
            )}
            {managers.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Managers ({managers.length})</Typography>
                    {managers.map(m => (
                        <ListItem key={m.id} dense>
                            <ListItemAvatar><Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'secondary.main' }}>{m.name?.[0]?.toUpperCase()}</Avatar></ListItemAvatar>
                            <ListItemText primary={m.name} secondary={m.email} primaryTypographyProps={{ fontSize: 14 }} secondaryTypographyProps={{ fontSize: 12 }} />
                        </ListItem>
                    ))}
                </Box>
            )}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Jugadores ({players.length})</Typography>
            {players.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>No hay jugadores</Typography> : players.map(p => (
                <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{p.name?.[0]?.toUpperCase()}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>{getDisplayName(p) || p.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>DNI: {p.dni || '-'}</Typography>
                    </Box>
                    <Tooltip title="Ver Perfil"><IconButton size="small" color="info" onClick={() => setViewPlayer(p)}><Visibility fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Editar"><IconButton size="small" onClick={() => onEditPlayer(p)}><Edit fontSize="small" /></IconButton></Tooltip>
                </Box>
            ))}
            {viewPlayer && <CoachPlayerProfileDialog player={viewPlayer} division={division} onClose={() => setViewPlayer(null)} />}
        </Box>
    );
}

// ================= Player Profile Dialog (View Only, for Coach) =================
function CoachPlayerProfileDialog({ player, division, onClose }) {
    const currentYear = new Date().getFullYear();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const payments = player.clubFeePayments || {};
    const paidYears = player.paidPlayerRightsYears || [];
    const [address, setAddress] = useState(null);

    useEffect(() => {
        if (player.addressId) {
            getDoc(doc(db, 'addresses', player.addressId)).then(snap => {
                if (snap.exists()) setAddress(snap.data());
            }).catch(console.error);
        }
    }, [player.addressId]);

    const calcAge = (bd) => { if (!bd) return '-'; const d = bd instanceof Date ? bd : new Date(bd); return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000)); };
    const formatDate = (bd) => { if (!bd) return '-'; const d = bd instanceof Date ? bd : new Date(bd); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontSize: 20 }}>{player.name?.[0]?.toUpperCase()}</Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>{getDisplayName(player) || player.name}</Typography>
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
                    <Box><Typography variant="caption" color="text.secondary">Obra Social</Typography><Typography variant="body2" fontWeight={500}>{player.obraSocial || '-'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Contacto de Emergencia</Typography><Typography variant="body2" fontWeight={500}>{player.emergencyContactName ? `${player.emergencyContactName} (${player.emergencyContactPhone || '-'})` : '-'}</Typography></Box>
                    <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" color="text.secondary">Dirección</Typography>
                        <Typography variant="body2" fontWeight={500}>
                            {address ? `${address.calle || ''} ${address.numero || ''}${address.departamento ? ` Dpto: ${address.departamento}` : ''}, ${address.localidad || ''}` : '-'}
                        </Typography>
                    </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Cuotas del Club — {currentYear}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                    {months.map((m, i) => {
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`; const paid = !!payments[key]; return (
                            <Chip key={key} label={m.substring(0, 3)} size="small" color={paid ? 'success' : 'default'} variant={paid ? 'filled' : 'outlined'} sx={{ justifyContent: 'center' }} />
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
                        <Chip key={y} label={y} size="small" color={paidYears.includes(y) ? 'success' : 'default'} variant={paidYears.includes(y) ? 'filled' : 'outlined'} />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions><Button onClick={onClose} variant="outlined">Cerrar</Button></DialogActions>
        </Dialog>
    );
}

// ================= Coach Edit Player Dialog =================
function CoachEditPlayerDialog({ player, divisions, onClose, onSuccess }) {
    const [name, setName] = useState(player.name);
    const [nickname, setNickname] = useState(player.nickname || '');
    const [dni, setDni] = useState(player.dni || '');
    const [obraSocial, setObraSocial] = useState(player.obraSocial || '');
    const [emergencyContactName, setEmergencyContactName] = useState(player.emergencyContactName || '');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState(player.emergencyContactPhone || '');
    const [birthDate, setBirthDate] = useState(() => {
        if (!player.birthDate) return '';
        const d = player.birthDate?.toDate ? player.birthDate.toDate() : (player.birthDate instanceof Date ? player.birthDate : new Date(player.birthDate));
        return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
    });
    const [divisionId, setDivisionId] = useState(player.divisionId);
    const [clubFeePayments, setClubFeePayments] = useState({ ...player.clubFeePayments });
    const [paidYears, setPaidYears] = useState([...(player.paidPlayerRightsYears || [])]);
    const [notes, setNotes] = useState(player.notes || []);
    const [loading, setLoading] = useState(false);
    
    const [addressOpen, setAddressOpen] = useState(false);
    const [playerAddress, setPlayerAddress] = useState(null);

    useEffect(() => {
        if (player.addressId) {
            getDocs(query(collection(db, 'addresses'), where('__name__', '==', player.addressId))).then(snap => {
                if (!snap.empty) {
                    setPlayerAddress(AddressModel.fromMap(snap.docs[0].data(), snap.docs[0].id));
                }
            });
        }
    }, [player.addressId]);

    const currentYear = new Date().getFullYear();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            let addressId = player.addressId || null;
            if (playerAddress) {
                if (addressId) {
                    await updateDoc(doc(db, 'addresses', addressId), playerAddress.toMap());
                } else {
                    const docRef = doc(collection(db, 'addresses'));
                    addressId = docRef.id;
                    playerAddress.id = addressId;
                    await setDoc(docRef, playerAddress.toMap());
                }
            }

            const data = { name: name.trim(), nickname: nickname.trim(), dni: dni.trim(), obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null, divisionId, clubFeePayments, paidPlayerRightsYears: paidYears, notes, addressId };
            await updateDoc(doc(db, 'players', player.id), data);
            if (player.userId) {
                try { await updateDoc(doc(db, 'users', player.userId), { name: name.trim(), nickname: nickname.trim(), dni: dni.trim(), obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null, addressId }); } catch (e) { console.log('Linked user update:', e); }
            }
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar Jugador</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre y Apellido" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="Apodo (Opcional)" value={nickname} onChange={e => setNickname(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="DNI" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Obra Social (Opcional)" value={obraSocial} onChange={e => setObraSocial(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Nombre) (Opcional)" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Teléfono) (Opcional)" value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />
                
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button variant="outlined" onClick={() => setAddressOpen(true)}>
                        {playerAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                    </Button>
                    {playerAddress && (
                        <Typography variant="caption" color="text.secondary">
                            {playerAddress.calle} {playerAddress.numero}{playerAddress.departamento ? ` Dpto: ${playerAddress.departamento}` : ''}, {playerAddress.localidad}
                        </Typography>
                    )}
                </Box>

                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>División</InputLabel>
                    <Select value={divisionId} label="División" onChange={e => setDivisionId(e.target.value)}>
                        {divisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.year})</MenuItem>)}
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
                    <ListItemButton key={y} dense onClick={() => setPaidYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}>
                        <Checkbox checked={paidYears.includes(y)} size="small" />
                        <ListItemText primary={`Año ${y}`} />
                    </ListItemButton>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
            <AddressDialog
                open={addressOpen}
                initialAddress={playerAddress}
                onSave={(addr) => { setPlayerAddress(addr); setAddressOpen(false); }}
                onClose={() => setAddressOpen(false)}
            />
        </Dialog>
    );
}
