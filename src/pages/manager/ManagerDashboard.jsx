import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { db, secondaryApp } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { AddressModel } from '../../models/AddressModel';
import AddressDialog from '../../components/shared/AddressDialog';
import { getDisplayName } from '../../models/UserModel';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import {
    Box, Typography, Card, CardContent, Grid, Fade, Chip, Avatar, Button, Divider,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Snackbar, Alert, List, ListItem, ListItemAvatar, ListItemText, Checkbox,
    ListItemButton, FormControl, InputLabel, Select, MenuItem, CircularProgress
} from '@mui/material';
import {
    Groups as GroupsIcon, People as PeopleIcon, EventNote as EventIcon,
    Edit as EditIcon, Visibility, Assignment, PersonAdd, Add
} from '@mui/icons-material';

export default function ManagerDashboard() {
    const { userModel } = useAuth();
    const location = useLocation();
    const [divisions, setDivisions] = useState([]);
    const [selectedDivisionId, setSelectedDivisionId] = useState('');
    const [players, setPlayers] = useState([]);
    const [attendanceCount, setAttendanceCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let divIds = [];
        if (userModel?.assignedDivisionIds?.length > 0) {
            divIds = userModel.assignedDivisionIds;
        } else if (userModel?.assignedDivisionId) {
            divIds = [userModel.assignedDivisionId];
        }

        if (divIds.length === 0) {
            setLoading(false);
            return;
        }

        const unsubs = [];

        // Fetch all assigned divisions
        const fetchDivisions = async () => {
            try {
                const loadedDivs = [];
                for (const dId of divIds) {
                    const snap = await getDocs(query(collection(db, 'divisions'), where('__name__', '==', dId)));
                    if (!snap.empty) {
                        loadedDivs.push(divisionModelFromMap({ ...snap.docs[0].data(), id: snap.docs[0].id }));
                    }
                }
                setDivisions(loadedDivs);
                if (loadedDivs.length > 0 && !selectedDivisionId) {
                    setSelectedDivisionId(loadedDivs[0].id);
                }
            } catch (err) {
                console.error("Error fetching manager divisions:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDivisions();

        return () => unsubs.forEach(u => u());
    }, [userModel]);

    useEffect(() => {
        if (!selectedDivisionId) return;

        const unsubs = [];

        // Players for selected division
        unsubs.push(onSnapshot(query(collection(db, 'players'), where('divisionId', '==', selectedDivisionId)), snap => {
            setPlayers(snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name)));
        }));

        // Attendance for selected division
        unsubs.push(onSnapshot(query(collection(db, 'attendance'), where('divisionId', '==', selectedDivisionId)), snap => {
            setAttendanceCount(snap.size);
        }));

        return () => unsubs.forEach(u => u());
    }, [selectedDivisionId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

    if (divisions.length === 0) {
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
                    <Card><CardContent><Typography color="text.secondary">No tenés ninguna división asignada.</Typography></CardContent></Card>
                </Box>
            </Fade>
        );
    }

    const currentDivision = divisions.find(d => d.id === selectedDivisionId) || divisions[0];

    const divisionSelector = divisions.length > 1 ? (
        <FormControl size="small" sx={{ minWidth: 200, mt: { xs: 2, sm: 0 } }}>
            <InputLabel>División Seleccionada</InputLabel>
            <Select
                value={selectedDivisionId}
                label="División Seleccionada"
                onChange={(e) => setSelectedDivisionId(e.target.value)}
            >
                {divisions.map(div => (
                    <MenuItem key={div.id} value={div.id}>{div.name}</MenuItem>
                ))}
            </Select>
        </FormControl>
    ) : null;

    return (
        <Routes>
            <Route path="/*" element={<ManagerOverview division={currentDivision} players={players} attendanceCount={attendanceCount} divisionSelector={divisionSelector} />} />
            <Route path="/players" element={<ManagerPlayers division={currentDivision} players={players} divisionSelector={divisionSelector} />} />
        </Routes>
    );
}

// ─── Sub-page: Overview ──────────────────────────────────────────────
function ManagerOverview({ division, players, attendanceCount, divisionSelector }) {
    const { userModel } = useAuth();
    const navigate = useNavigate();
    const [editDiv, setEditDiv] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h4" fontWeight={800}>
                            ¡Hola, {userModel?.name?.split(' ')[0]}! 📋
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Panel de Manager
                        </Typography>
                    </Box>
                    {divisionSelector}
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
                        <Card 
                            onClick={() => navigate('/manager/players')}
                            sx={{ background: 'linear-gradient(135deg, #1B5E2015 0%, #1B5E2008 100%)', cursor: 'pointer', transition: '0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
                            <CardContent sx={{ p: 3, textAlign: 'center' }}>
                                <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                                <Typography variant="h3" fontWeight={800} color="primary.main">{players.length}</Typography>
                                <Typography variant="body2" color="text.secondary">Jugadores</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Card 
                            onClick={() => navigate('/manager/history')}
                            sx={{ background: 'linear-gradient(135deg, #1565C015 0%, #1565C008 100%)', cursor: 'pointer', transition: '0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
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
function ManagerPlayers({ division, players, divisionSelector }) {
    const [viewPlayer, setViewPlayer] = useState(null);
    const [editPlayer, setEditPlayer] = useState(null);
    const [createPlayer, setCreatePlayer] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="h4" fontWeight={800}>Jugadores de {division.name}</Typography>
                        <Typography variant="body1" color="text.secondary">Gestioná los jugadores de tu división</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        {divisionSelector}
                        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setCreatePlayer(true)}>
                            Añadir Jugador
                        </Button>
                    </Box>
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
                                                primary={<Typography fontWeight={600}>{getDisplayName(p) || p.name}</Typography>}
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

                {createPlayer && (
                    <ManagerCreatePlayerDialog
                        division={division}
                        onClose={() => setCreatePlayer(false)}
                        onSuccess={() => { setCreatePlayer(false); setSnack({ open: true, msg: 'Jugador creado exitosamente', severity: 'success' }); }}
                    />
                )}

                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                    <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
    // closing bracket
}

// ─── Manager Create Player Dialog ──────────────────────────────────────
function ManagerCreatePlayerDialog({ division, onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [dni, setDni] = useState('');
    const [phone, setPhone] = useState('');
    const [obraSocial, setObraSocial] = useState('');
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [addressOpen, setAddressOpen] = useState(false);
    const [playerAddress, setPlayerAddress] = useState(null);

    const handleCreate = async () => {
        if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
        if (!email.trim()) { setError('El email es obligatorio.'); return; }
        if (!dni.trim()) { setError('El DNI es obligatorio.'); return; }

        setError('');
        setLoading(true);
        try {
            // Check for duplicate email/DNI
            const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
            if (!emailSnap.empty) { setError('Ya existe un usuario con ese email.'); setLoading(false); return; }
            const dniSnap = await getDocs(query(collection(db, 'users'), where('dni', '==', dni.trim())));
            if (!dniSnap.empty) { setError('Ya existe un usuario con ese DNI.'); setLoading(false); return; }

            // Create Firebase Auth user via secondary app (DNI as password)
            const secondaryAuth = getAuth(secondaryApp);
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), dni.trim());
            const userId = cred.user.uid;
            await secondaryAuth.signOut();

            const username = email.trim().split('@')[0];
            const nameLower = name.trim().toLowerCase();
            const nicknameLower = nickname.trim().toLowerCase();
            const keywords = [nameLower, ...nameLower.split(' '), email.trim().toLowerCase(), dni.trim()];
            if (nicknameLower) {
                keywords.push(nicknameLower);
                keywords.push(...nicknameLower.split(' '));
            }

            let addressId = null;
            if (playerAddress) {
                const docRef = doc(collection(db, 'addresses'));
                addressId = docRef.id;
                playerAddress.id = addressId;
                await setDoc(docRef, playerAddress.toMap());
            }

            // Create user document with player role
            await setDoc(doc(db, 'users', userId), {
                id: userId,
                email: email.trim(),
                name: name.trim(),
                nickname: nickname.trim(),
                username,
                dni: dni.trim(),
                phone: phone.trim(),
                obraSocial: obraSocial.trim(),
                emergencyContactName: emergencyContactName.trim(),
                emergencyContactPhone: emergencyContactPhone.trim(),
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                addressId,
                roles: ['player'],
                role: 'player',
                assignedDivisionId: division.id,
                assignedBlockId: null,
                assignedPlayerIds: [],
                keywords,
                createdAt: new Date().toISOString(),
            });

            // Create player document
            const playerRef = doc(collection(db, 'players'));
            await setDoc(playerRef, {
                id: playerRef.id,
                userId: userId,
                name: name.trim(),
                nickname: nickname.trim(),
                email: email.trim(),
                dni: dni.trim(),
                phone: phone.trim(),
                obraSocial: obraSocial.trim(),
                emergencyContactName: emergencyContactName.trim(),
                emergencyContactPhone: emergencyContactPhone.trim(),
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                divisionId: division.id,
                addressId,
                clubFeePayments: {},
                paidPlayerRightsYears: [],
                notes: [],
            });

            onSuccess();
        } catch (e) {
            console.error('Create player error:', e);
            if (e.code === 'auth/email-already-in-use') setError('El email ya está registrado en Firebase Auth.');
            else if (e.code === 'auth/weak-password') setError('El DNI debe tener al menos 6 caracteres (se usa como contraseña).');
            else setError('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Agregar Jugador a {division.name}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{error}</Alert>}
                <TextField fullWidth label="Nombre y Apellido" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} autoFocus />
                <TextField fullWidth label="Apodo (Opcional)" value={nickname} onChange={e => setNickname(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} sx={{ mt: 2 }}
                    helperText="El nombre de usuario se generará automáticamente del email" />
                <TextField fullWidth label="DNI (se usa como contraseña inicial)" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Obra Social (Opcional)" value={obraSocial} onChange={e => setObraSocial(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Nombre) (Opcional)" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Teléfono) (Opcional)" value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                    sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />
                
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button variant="outlined" onClick={() => setAddressOpen(true)}>
                        {playerAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                    </Button>
                    {playerAddress && (
                        <Typography variant="caption" color="text.secondary">
                            {playerAddress.calle} {playerAddress.numero}{playerAddress.departamento ? ' Dpto: ' + playerAddress.departamento : ''}, {playerAddress.localidad}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleCreate} variant="contained" disabled={loading}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PersonAdd />}>
                    {loading ? 'Creando...' : 'Crear Jugador'}
                </Button>
            </DialogActions>

            <AddressDialog
                open={addressOpen}
                initialAddress={playerAddress}
                onClose={() => setAddressOpen(false)}
                onSave={(addr) => { setPlayerAddress(addr); setAddressOpen(false); }}
            />
        </Dialog>
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
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Notas / Observaciones</Typography>
                {(!player.notes || player.notes.length === 0) ? (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">No hay notas registradas.</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {[...player.notes].sort((a, b) => new Date(b.date) - new Date(a.date)).map((note, index) => (
                            <Card key={index} variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{note.text}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    {new Date(note.date).toLocaleString('es-AR', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </Typography>
                            </Card>
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions><Button onClick={onClose} variant="outlined">Cerrar</Button></DialogActions>
        </Dialog>
    );
}

// ─── Manager Edit Player Dialog ────────────────────────────────────
function ManagerEditPlayerDialog({ player, division, onClose, onSuccess }) {
    const [name, setName] = useState(player.name);
    const [nickname, setNickname] = useState(player.nickname || '');
    const [dni, setDni] = useState(player.dni || '');
    const [obraSocial, setObraSocial] = useState(player.obraSocial || '');
    const [emergencyContactName, setEmergencyContactName] = useState(player.emergencyContactName || '');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState(player.emergencyContactPhone || '');
    const [birthDate, setBirthDate] = useState(player.birthDate ? (player.birthDate instanceof Date ? player.birthDate : new Date(player.birthDate)).toISOString().split('T')[0] : '');
    const [clubFeePayments, setClubFeePayments] = useState({ ...player.clubFeePayments });
    const [paidYears, setPaidYears] = useState([...(player.paidPlayerRightsYears || [])]);
    const [notes, setNotes] = useState([...(player.notes || [])]);
    const [newNote, setNewNote] = useState('');
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

    const handleAddNote = () => {
        if (!newNote.trim()) return;
        setNotes([{ date: new Date().toISOString(), text: newNote.trim() }, ...notes]);
        setNewNote('');
    };

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

            const data = { name: name.trim(), nickname: nickname.trim(), dni: dni.trim(), obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null, clubFeePayments, paidPlayerRightsYears: paidYears, notes, addressId };
            await updateDoc(doc(db, 'players', player.id), data);
            if (player.userId) {
                try { await updateDoc(doc(db, 'users', player.userId), { name: name.trim(), nickname: nickname.trim(), dni: dni.trim(), obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null, addressId }); } catch (e) { console.log('Linked user update error:', e); }
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
                    <Button variant="outlined" onClick={() => setAddressOpen(true)} startIcon={<Add />}>
                        {playerAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                    </Button>
                    {playerAddress && (
                        <Typography variant="caption" color="text.secondary">
                            {playerAddress.calle} {playerAddress.numero}{playerAddress.departamento ? ` Dpto: ${playerAddress.departamento}` : ''}, {playerAddress.localidad}
                        </Typography>
                    )}
                </Box>

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
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Notas / Observaciones</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField size="small" fullWidth placeholder="Nueva nota..." value={newNote} onChange={e => setNewNote(e.target.value)} />
                    <Button variant="contained" onClick={handleAddNote} disabled={!newNote.trim()}>Agregar</Button>
                </Box>
                {notes.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No hay notas registradas.</Typography>
                ) : (
                    <List dense disablePadding sx={{ mb: 2 }}>
                        {notes.map((n, i) => (
                            <ListItem key={i} sx={{ bgcolor: 'action.hover', mb: 1, borderRadius: 1 }}>
                                <ListItemText
                                    primary={n.text}
                                    secondary={new Date(n.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
            {addressOpen && (
                <AddressDialog
                    open={addressOpen}
                    initialAddress={playerAddress}
                    onSave={(addr) => { setPlayerAddress(addr); setAddressOpen(false); }}
                    onClose={() => setAddressOpen(false)}
                />
            )}
        </Dialog>
    );
}
