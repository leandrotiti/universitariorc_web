import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, RoleLabels, userModelFromMap } from '../../models/UserModel';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import ReportsPage from '../admin/ReportsPage';
import {
    Box, Typography, Card, CardContent, Grid, Fade, List, ListItem, ListItemAvatar, ListItemText,
    Avatar, Chip, IconButton, TextField, FormControl, InputLabel, Select, MenuItem, InputAdornment,
    Switch, FormControlLabel, Accordion, AccordionSummary, AccordionDetails, Divider,
    Button, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, ListItemButton,
    Snackbar, Alert, CircularProgress, Tooltip
} from '@mui/material';
import {
    Search, Close, Edit, Delete, Restore, ExpandMore, Add, PersonAdd, Shield, People,
    Groups, Assessment, CalendarMonth, Visibility
} from '@mui/icons-material';
import { db, secondaryApp } from '../../config/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function BlockAdminDashboard({ page }) {
    const { userModel } = useAuth();
    const [block, setBlock] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userModel?.assignedBlockId) { setLoading(false); return; }
        const unsub = onSnapshot(doc(db, 'blocks', userModel.assignedBlockId), snap => {
            if (snap.exists()) setBlock({ id: snap.id, ...snap.data() });
            setLoading(false);
        });
        return unsub;
    }, [userModel]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (!block) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography>No tienes un bloque asignado.</Typography></Box>;

    const allowedDivisionIds = block.divisionIds || [];

    const renderContent = () => {
        switch (page) {
            case 'users':
                return <BlockUsersTab block={block} allowedDivisionIds={allowedDivisionIds} />;
            case 'divisions':
                return <BlockDivisionsTab block={block} allowedDivisionIds={allowedDivisionIds} />;
            case 'reports':
                return <ReportsPage allowedDivisionIds={allowedDivisionIds} />;
            default:
                return <BlockDashboardOverview block={block} allowedDivisionIds={allowedDivisionIds} userName={userModel?.name} />;
        }
    };

    return (
        <Fade in timeout={400}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {renderContent()}
                </Box>
            </Box>
        </Fade>
    );
}

// ─── Dashboard Overview ────────────────────────────────────────────
function BlockDashboardOverview({ block, allowedDivisionIds, userName }) {
    const navigate = useNavigate();
    const [userCount, setUserCount] = useState(0);
    const [divisionCount, setDivisionCount] = useState(0);
    const [playerCount, setPlayerCount] = useState(0);

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(collection(db, 'users'), snap => {
            const users = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            const blockUsers = users.filter(u => {
                if (u.assignedBlockId === block.id) return true;
                if (u.assignedDivisionId && allowedDivisionIds.includes(u.assignedDivisionId)) return true;
                return false;
            });
            setUserCount(blockUsers.length);
        }));
        unsubs.push(onSnapshot(collection(db, 'divisions'), snap => {
            const divs = snap.docs.filter(d => allowedDivisionIds.includes(d.id) && !d.data().isHidden);
            setDivisionCount(divs.length);
        }));
        unsubs.push(onSnapshot(collection(db, 'players'), snap => {
            const blockPlayers = snap.docs.filter(d => allowedDivisionIds.includes(d.data().divisionId));
            setPlayerCount(blockPlayers.length);
        }));
        return () => unsubs.forEach(u => u());
    }, [block.id, allowedDivisionIds]);

    const stats = [
        { label: 'Usuarios', value: userCount, icon: <People />, color: '#1e88e5', path: '/block-admin/users' },
        { label: 'Divisiones', value: divisionCount, icon: <Groups />, color: '#43a047', path: '/block-admin/divisions' },
        { label: 'Jugadores', value: playerCount, icon: <People />, color: '#8e24aa', path: '/block-admin/divisions' },
    ];

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>
                    ¡Hola, {userName?.split(' ')[0]}! 🏆
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Panel de Jefe de Bloque — {block.name}
                </Typography>
            </Box>
            <Grid container spacing={3}>
                {stats.map(s => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.label}>
                        <Card onClick={() => navigate(s.path)} sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: s.color, width: 56, height: 56 }}>{s.icon}</Avatar>
                                <Box>
                                    <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}

// ─── Users Tab ─────────────────────────────────────────────────────
function BlockUsersTab({ block, allowedDivisionIds }) {
    const [allUsers, setAllUsers] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [searchField, setSearchField] = useState('Nombre');
    const [createOpen, setCreateOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })))));
        unsubs.push(onSnapshot(collection(db, 'divisions'), snap => setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })))));
        unsubs.push(onSnapshot(collection(db, 'players'), snap => setPlayers(snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id })))));
        return () => unsubs.forEach(u => u());
    }, []);

    const activeDivisions = useMemo(() => divisions.filter(d => allowedDivisionIds.includes(d.id) && !d.isHidden), [divisions, allowedDivisionIds]);
    const activeDivIds = useMemo(() => new Set(activeDivisions.map(d => d.id)), [activeDivisions]);
    const blockPlayers = useMemo(() => players.filter(p => activeDivIds.has(p.divisionId)), [players, activeDivIds]);
    const blockPlayerIds = useMemo(() => new Set(blockPlayers.map(p => p.id)), [blockPlayers]);
    const blockCoachIds = useMemo(() => { const s = new Set(); activeDivisions.forEach(d => d.coachIds.forEach(id => s.add(id))); return s; }, [activeDivisions]);
    const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d.name.toLowerCase()])), [divisions]);

    const filtered = useMemo(() => {
        return allUsers.filter(u => {
            let match = false;
            if (u.assignedBlockId === block.id) match = true;
            else if (u.assignedDivisionId && activeDivIds.has(u.assignedDivisionId)) match = true;
            else if (blockCoachIds.has(u.id)) match = true;
            else if (u.roles.includes('parent') && u.assignedPlayerIds.some(pid => blockPlayerIds.has(pid))) match = true;
            else if (u.roles.includes('player') && blockPlayers.some(p => p.userId === u.id)) match = true;
            if (!match) return false;
            if (searchText) {
                const q = searchText.toLowerCase();
                if (searchField === 'Nombre') return u.name.toLowerCase().includes(q);
                if (searchField === 'DNI') return (u.dni || '').toLowerCase().includes(q);
                if (searchField === 'Email') return u.email.toLowerCase().includes(q);
                if (searchField === 'División') {
                    if (u.assignedDivisionId && (divMap[u.assignedDivisionId] || '').includes(q)) return true;
                    return false;
                }
            }
            return true;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [allUsers, block, activeDivIds, blockCoachIds, blockPlayerIds, blockPlayers, searchText, searchField, divMap]);

    // Only block divisions for creating users
    const blockDivisions = useMemo(() => divisions.filter(d => allowedDivisionIds.includes(d.id) && !d.isHidden), [divisions, allowedDivisionIds]);

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField size="small" placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment>, endAdornment: searchText && <InputAdornment position="end"><IconButton size="small" onClick={() => setSearchText('')}><Close fontSize="small" /></IconButton></InputAdornment> }} />
                <FormControl size="small" sx={{ minWidth: 110 }}>
                    <Select value={searchField} onChange={e => setSearchField(e.target.value)}>
                        {['Nombre', 'DNI', 'Email', 'División'].map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setCreateOpen(true)}>Crear Usuario</Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{filtered.length} usuario(s)</Typography>
            <List>
                {filtered.map(u => (
                    <ListItem key={u.id} divider secondaryAction={
                        <IconButton size="small" onClick={() => setEditUser(u)}><Edit fontSize="small" /></IconButton>
                    }>
                        <ListItemAvatar><Avatar sx={{ bgcolor: getRoleColor(u.roles[0]) }}>{u.name?.[0]?.toUpperCase() || '?'}</Avatar></ListItemAvatar>
                        <ListItemText primary={u.name} secondary={<>{u.email}<br />{u.roles.map(r => RoleLabels[r] || r).join(', ')}</>} />
                    </ListItem>
                ))}
            </List>
            <BlockCreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} divisions={blockDivisions} players={blockPlayers} blockId={block.id}
                onSuccess={(msg) => { setCreateOpen(false); setSnack({ open: true, msg: msg || 'Usuario creado', severity: 'success' }); }} />
            {editUser && <BlockEditUserDialog user={editUser} onClose={() => setEditUser(null)} divisions={blockDivisions} players={blockPlayers}
                onSuccess={() => { setEditUser(null); setSnack({ open: true, msg: 'Usuario actualizado', severity: 'success' }); }} />}
            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}><Alert severity={snack.severity}>{snack.msg}</Alert></Snackbar>
        </Box>
    );
}

// ─── Block Create User Dialog (scoped to block divisions) ──────────
function BlockCreateUserDialog({ open, onClose, divisions, players, blockId, onSuccess }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [dni, setDni] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [selectedRoles, setSelectedRoles] = useState(['player']);
    const [selectedDivisionId, setSelectedDivisionId] = useState('');
    const [selectedCoachDivIds, setSelectedCoachDivIds] = useState([]);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
    const [loading, setLoading] = useState(false);

    const allowedRoles = ['player', 'coach', 'manager', 'parent'];
    const activeDivisions = [...divisions].sort((a, b) => { const n = a.name.match(/\d+/); const m = b.name.match(/\d+/); if (n && m) return parseInt(n[0]) - parseInt(m[0]); return a.name.localeCompare(b.name); });

    useEffect(() => {
        if (!open) return;
        setName(''); setEmail(''); setDni(''); setPhone(''); setBirthDate('');
        setSelectedRoles(['player']); setSelectedDivisionId(''); setSelectedCoachDivIds([]);
        setSelectedPlayerIds([]); setLoading(false);
    }, [open]);

    const toggleRole = (role) => {
        setSelectedRoles(prev => {
            if (prev.includes(role)) return prev.length > 1 ? prev.filter(r => r !== role) : prev;
            return [...prev, role];
        });
    };

    const handleCreate = async () => {
        if (!name.trim() || !email.trim() || !dni.trim() || !phone.trim()) { alert('Todos los campos son requeridos'); return; }
        if (!email.includes('@')) { alert('Email inválido'); return; }
        if (selectedRoles.includes('player') && !birthDate) { alert('Fecha de nacimiento es requerida para jugadores'); return; }
        if ((selectedRoles.includes('player') || selectedRoles.includes('manager')) && !selectedDivisionId) { alert('División es requerida'); return; }
        setLoading(true);
        try {
            const existingEmail = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
            if (!existingEmail.empty) { alert('Este email ya está registrado'); setLoading(false); return; }
            const existingDni = await getDocs(query(collection(db, 'users'), where('dni', '==', dni.trim())));
            if (!existingDni.empty) { alert('Este DNI ya está registrado'); setLoading(false); return; }
            if (selectedRoles.includes('manager') && selectedDivisionId) {
                const existingMgr = await getDocs(query(collection(db, 'users'), where('roles', 'array-contains', 'manager'), where('assignedDivisionId', '==', selectedDivisionId)));
                if (!existingMgr.empty) { alert('Esta división ya tiene un manager asignado'); setLoading(false); return; }
            }
            const secondaryAuth = getAuth(secondaryApp);
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), dni.trim());
            const userId = cred.user.uid;
            await secondaryAuth.signOut();
            const username = email.trim().split('@')[0];
            const nameLower = name.trim().toLowerCase();
            const keywords = [...nameLower.split(' '), email.trim().toLowerCase(), username, dni.trim()];
            await setDoc(doc(db, 'users', userId), {
                id: userId, name: name.trim(), email: email.trim(), username, dni: dni.trim(), phone: phone.trim(),
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                role: selectedRoles[0], roles: selectedRoles,
                assignedDivisionId: selectedDivisionId || null,
                assignedBlockId: null,
                assignedPlayerIds: selectedPlayerIds,
                createdAt: new Date(), keywords,
            });
            if (selectedRoles.includes('player') && selectedDivisionId) {
                const playerRef = doc(collection(db, 'players'));
                await setDoc(playerRef, {
                    id: playerRef.id, name: name.trim(), divisionId: selectedDivisionId, dni: dni.trim(),
                    userId, birthDate: new Date(birthDate).toISOString(), phone: phone.trim(), email: email.trim(),
                    clubFeePayments: {}, paidPlayerRightsYears: [], photoUrl: null,
                });
            }
            if (selectedRoles.includes('coach') && selectedCoachDivIds.length > 0) {
                const batch = writeBatch(db);
                selectedCoachDivIds.forEach(divId => batch.update(doc(db, 'divisions', divId), { coachIds: arrayUnion(userId) }));
                await batch.commit();
            }
            onSuccess('Usuario creado exitosamente');
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    if (!open) return null;
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Crear Usuario</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre Completo *" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="Email *" value={email} onChange={e => setEmail(e.target.value)} type="email" sx={{ mt: 2 }} />
                <TextField fullWidth label="DNI (Contraseña inicial) *" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} helperText="El DNI será usado como contraseña inicial" />
                <TextField fullWidth label="Teléfono *" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} helperText={selectedRoles.includes('player') ? 'Requerido para jugadores' : ''} />
                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Roles</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {allowedRoles.map(role => (
                        <Chip key={role} label={RoleLabels[role] || role} color={selectedRoles.includes(role) ? 'primary' : 'default'} variant={selectedRoles.includes(role) ? 'filled' : 'outlined'} onClick={() => toggleRole(role)} size="small" />
                    ))}
                </Box>
                {(selectedRoles.includes('player') || selectedRoles.includes('manager')) && (
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Asignar División *</InputLabel>
                        <Select value={selectedDivisionId} label="Asignar División *" onChange={e => setSelectedDivisionId(e.target.value)}>
                            {activeDivisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.year})</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {selectedRoles.includes('coach') && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Asignar Divisiones (Entrenador)</Typography>
                        <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                            {activeDivisions.map(d => (
                                <ListItemButton key={d.id} dense onClick={() => setSelectedCoachDivIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}>
                                    <Checkbox checked={selectedCoachDivIds.includes(d.id)} size="small" />
                                    <ListItemText primary={d.name} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
                )}
                {selectedRoles.includes('parent') && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Asignar Hijos</Typography>
                        <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                            {players.map(p => (
                                <ListItemButton key={p.id} dense onClick={() => setSelectedPlayerIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                                    <Checkbox checked={selectedPlayerIds.includes(p.id)} size="small" />
                                    <ListItemText primary={p.name} secondary={`DNI: ${p.dni}`} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
                )}
                {email && <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Username automático: {email.split('@')[0]}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleCreate} variant="contained" disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Crear'}</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Divisions Tab ─────────────────────────────────────────────────
function BlockDivisionsTab({ block, allowedDivisionIds }) {
    const navigate = useNavigate();
    const [divisions, setDivisions] = useState([]);
    const [showHidden, setShowHidden] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editDiv, setEditDiv] = useState(null);
    const [editPlayer, setEditPlayer] = useState(null);
    const [createPlayerDiv, setCreatePlayerDiv] = useState(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'divisions'), snap => {
            setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })).filter(d => allowedDivisionIds.includes(d.id)));
        });
        return unsub;
    }, [allowedDivisionIds]);

    const filtered = divisions.filter(d => showHidden || !d.isHidden).sort((a, b) => {
        const na = a.name.match(/\d+/); const nb = b.name.match(/\d+/);
        if (na && nb) return parseInt(na[0]) - parseInt(nb[0]);
        return a.name.localeCompare(b.name);
    });

    const handleHideOrDelete = async (div) => {
        try {
            const playersSnap = await getDocs(query(collection(db, 'players'), where('divisionId', '==', div.id)));
            const hasPlayers = !playersSnap.empty;
            const hasCoaches = div.coachIds.length > 0;
            if (hasPlayers || hasCoaches) {
                const msg = `La división "${div.name}" tiene ${hasPlayers ? playersSnap.size + ' jugador(es)' : ''}${hasPlayers && hasCoaches ? ' y ' : ''}${hasCoaches ? div.coachIds.length + ' entrenador(es)' : ''} asignados.\n\n¿Desea ocultarla (archivarla) en su lugar?`;
                if (window.confirm(msg)) {
                    await updateDoc(doc(db, 'divisions', div.id), { isHidden: true });
                    setSnack({ open: true, msg: 'División ocultada (archivada)', severity: 'info' });
                }
            } else {
                if (window.confirm(`¿Seguro que deseas eliminar la división "${div.name}"? Esta acción no se puede deshacer.`)) {
                    await deleteDoc(doc(db, 'divisions', div.id));
                    // Remove from block's divisionIds
                    await updateDoc(doc(db, 'blocks', block.id), { divisionIds: arrayRemove(div.id) });
                    setSnack({ open: true, msg: 'División eliminada', severity: 'success' });
                }
            }
        } catch (e) {
            console.error('Error:', e);
            setSnack({ open: true, msg: 'Error: ' + e.message, severity: 'error' });
        }
    };

    const handleRestore = async (div) => {
        try {
            await updateDoc(doc(db, 'divisions', div.id), { isHidden: false });
            setSnack({ open: true, msg: 'División restaurada', severity: 'success' });
        } catch (e) {
            setSnack({ open: true, msg: 'Error: ' + e.message, severity: 'error' });
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel control={<Switch checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />} label="Mostrar Ocultas" />
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Crear División</Button>
            </Box>
            {filtered.map(div => (
                <Accordion key={div.id} sx={{ mb: 1, opacity: div.isHidden ? 0.6 : 1, bgcolor: div.isHidden ? 'action.hover' : 'background.paper' }}>
                    <AccordionSummary expandIcon={<ExpandMore />} component="div">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mr: 1 }}>
                            <Avatar sx={{ bgcolor: div.isHidden ? 'grey.500' : 'primary.main', width: 36, height: 36 }}><Shield fontSize="small" /></Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontWeight: 600, textDecoration: div.isHidden ? 'line-through' : 'none' }}>
                                    {div.name} ({div.year}){div.isHidden ? ' [OCULTA]' : ''}
                                </Typography>
                                <DivisionSubtitle div={div} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }} onClick={e => e.stopPropagation()}>
                                <Tooltip title="Ver Asistencias">
                                    <IconButton size="small" color="info" onClick={() => navigate(`/coach/attendance-history/${div.id}`)}><CalendarMonth fontSize="small" /></IconButton>
                                </Tooltip>
                                <Tooltip title="Editar">
                                    <IconButton size="small" onClick={() => setEditDiv(div)}><Edit fontSize="small" /></IconButton>
                                </Tooltip>
                                <Tooltip title={div.isHidden ? 'Restaurar' : 'Ocultar/Eliminar'}>
                                    <IconButton size="small" color={div.isHidden ? 'success' : 'error'} onClick={() => div.isHidden ? handleRestore(div) : handleHideOrDelete(div)}>
                                        {div.isHidden ? <Restore fontSize="small" /> : <Delete fontSize="small" />}
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        <BlockDivisionPlayerList division={div} onCreatePlayer={() => setCreatePlayerDiv(div)} onEditPlayer={setEditPlayer} snack={setSnack} />
                    </AccordionDetails>
                </Accordion>
            ))}
            {filtered.length === 0 && <Typography color="text.secondary">No hay divisiones asignadas.</Typography>}

            <BlockCreateDivisionDialog open={createOpen} blockId={block.id} onClose={() => setCreateOpen(false)}
                onSuccess={() => { setCreateOpen(false); setSnack({ open: true, msg: 'División creada y asignada al bloque', severity: 'success' }); }} />
            {editDiv && <BlockEditDivisionDialog division={editDiv} onClose={() => setEditDiv(null)}
                onSuccess={() => { setEditDiv(null); setSnack({ open: true, msg: 'División actualizada', severity: 'success' }); }} />}
            {createPlayerDiv && <BlockCreatePlayerDialog division={createPlayerDiv} onClose={() => setCreatePlayerDiv(null)}
                onSuccess={() => { setCreatePlayerDiv(null); setSnack({ open: true, msg: 'Jugador creado exitosamente', severity: 'success' }); }} />}
            {editPlayer && <BlockEditPlayerDialog player={editPlayer} allowedDivisionIds={allowedDivisionIds} onClose={() => setEditPlayer(null)}
                onSuccess={() => { setEditPlayer(null); setSnack({ open: true, msg: 'Jugador actualizado', severity: 'success' }); }} />}
            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
            </Snackbar>
        </Box>
    );
}

// ─── Division Subtitle ─────────────────────────────────────────────
function DivisionSubtitle({ div }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, 'players'), where('divisionId', '==', div.id)), snap => setCount(snap.size));
        return unsub;
    }, [div.id]);
    return <Typography variant="body2" color="text.secondary">Entrenadores: {div.coachIds.length} | Jugadores: {count}</Typography>;
}

// ─── Division Player List (with coaches, managers, players + add button) ─
function BlockDivisionPlayerList({ division, onCreatePlayer, onEditPlayer, snack }) {
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

    const handleDeletePlayer = async (player) => {
        if (!window.confirm(`¿Eliminar la ficha del jugador ${player.name}?`)) return;
        try {
            await deleteDoc(doc(db, 'players', player.id));
            snack({ open: true, msg: `Jugador "${player.name}" eliminado`, severity: 'success' });
        } catch (e) {
            console.error('Delete player error:', e);
            snack({ open: true, msg: 'Error al eliminar: ' + e.message, severity: 'error' });
        }
    };

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
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>{p.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>DNI: {p.dni || '-'}</Typography>
                    </Box>
                    <Tooltip title="Ver Perfil"><IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); setViewPlayer(p); }}><Visibility fontSize="small" /></IconButton></Tooltip>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditPlayer(p); }}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeletePlayer(p); }}><Delete fontSize="small" /></IconButton>
                </Box>
            ))}
            <Button startIcon={<PersonAdd />} variant="outlined" size="small" sx={{ mt: 1.5 }} onClick={onCreatePlayer}>
                Agregar Jugador
            </Button>
            {viewPlayer && <PlayerProfileDialog player={viewPlayer} division={division} onClose={() => setViewPlayer(null)} />}
        </Box>
    );
}

// ─── Block Create Division Dialog ──────────────────────────────────
function BlockCreateDivisionDialog({ open, blockId, onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const ref = doc(collection(db, 'divisions'));
            await setDoc(ref, { id: ref.id, name: name.trim(), coachIds: [], year: parseInt(year) || new Date().getFullYear(), isHidden: false, customAttendanceTypes: [] });
            // Add division to the block
            await updateDoc(doc(db, 'blocks', blockId), { divisionIds: arrayUnion(ref.id) });
            setName(''); setYear(new Date().getFullYear().toString());
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    if (!open) return null;
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Crear División</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre (ej: M-10)" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} autoFocus />
                <TextField fullWidth label="Camada (Año)" value={year} onChange={e => setYear(e.target.value)} type="number" sx={{ mt: 2 }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleCreate} variant="contained" disabled={loading}>{loading ? 'Creando...' : 'Crear'}</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Block Create Player Dialog ────────────────────────────────────
function BlockCreatePlayerDialog({ division, onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [dni, setDni] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
        if (!email.trim()) { setError('El email es obligatorio.'); return; }
        if (!dni.trim()) { setError('El DNI es obligatorio.'); return; }
        setError('');
        setLoading(true);
        try {
            const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
            if (!emailSnap.empty) { setError('Ya existe un usuario con ese email.'); setLoading(false); return; }
            const dniSnap = await getDocs(query(collection(db, 'users'), where('dni', '==', dni.trim())));
            if (!dniSnap.empty) { setError('Ya existe un usuario con ese DNI.'); setLoading(false); return; }
            const secondaryAuth = getAuth(secondaryApp);
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), dni.trim());
            const userId = cred.user.uid;
            await secondaryAuth.signOut();
            const username = email.trim().split('@')[0];
            const nameLower = name.trim().toLowerCase();
            const keywords = [nameLower, ...nameLower.split(' '), email.trim().toLowerCase(), dni.trim()];
            await setDoc(doc(db, 'users', userId), {
                id: userId, email: email.trim(), name: name.trim(), username, dni: dni.trim(), phone: phone.trim(),
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                roles: ['player'], role: 'player',
                assignedDivisionId: division.id, assignedBlockId: null, assignedPlayerIds: [],
                keywords, createdAt: new Date().toISOString(),
            });
            const playerRef = doc(collection(db, 'players'));
            await setDoc(playerRef, {
                id: playerRef.id, userId, name: name.trim(), email: email.trim(), dni: dni.trim(), phone: phone.trim(),
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                divisionId: division.id, clubFeePayments: {}, paidPlayerRightsYears: [],
            });
            onSuccess();
        } catch (e) {
            console.error('Create player error:', e);
            if (e.code === 'auth/email-already-in-use') setError('El email ya está registrado en Firebase Auth.');
            else if (e.code === 'auth/weak-password') setError('El DNI debe tener al menos 6 caracteres (se usa como contraseña).');
            else setError('Error: ' + e.message);
        } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Agregar Jugador a {division.name}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{error}</Alert>}
                <TextField fullWidth label="Nombre completo" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} autoFocus />
                <TextField fullWidth label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} sx={{ mt: 2 }}
                    helperText="El nombre de usuario se generará automáticamente del email" />
                <TextField fullWidth label="DNI (se usa como contraseña inicial)" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                    sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleCreate} variant="contained" disabled={loading}
                    startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PersonAdd />}>
                    {loading ? 'Creando...' : 'Crear Jugador'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Block Edit User Dialog ────────────────────────────────────────
function BlockEditUserDialog({ user, onClose, divisions, players, onSuccess }) {
    const [name, setName] = useState(user.name);
    const [username, setUsername] = useState(user.username);
    const [dni, setDni] = useState(user.dni || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [birthDate, setBirthDate] = useState(user.birthDate ? user.birthDate.toISOString().split('T')[0] : '');
    const [selectedRoles, setSelectedRoles] = useState([...user.roles]);
    const [selectedDivisionId, setSelectedDivisionId] = useState(user.assignedDivisionId || '');
    const [selectedCoachDivIds, setSelectedCoachDivIds] = useState([]);
    const [initialCoachDivIds, setInitialCoachDivIds] = useState([]);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([...user.assignedPlayerIds]);
    const [loading, setLoading] = useState(false);

    const allowedRoles = ['player', 'coach', 'manager', 'parent'];
    const activeDivisions = [...divisions].sort((a, b) => a.name.localeCompare(b.name));

    useEffect(() => {
        if (user.roles.includes('coach')) {
            const unsub = onSnapshot(collection(db, 'divisions'), snap => {
                const allDivs = snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id }));
                const coachDivs = allDivs.filter(d => d.coachIds.includes(user.id)).map(d => d.id);
                setSelectedCoachDivIds(coachDivs);
                setInitialCoachDivIds(coachDivs);
            });
            return unsub;
        }
    }, [user.id]);

    const toggleRole = (role) => {
        setSelectedRoles(prev => {
            if (prev.includes(role)) return prev.length > 1 ? prev.filter(r => r !== role) : prev;
            return [...prev, role];
        });
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const nameLower = name.trim().toLowerCase();
            const keywords = [...nameLower.split(' '), user.email.toLowerCase(), (username || user.email.split('@')[0]).toLowerCase(), dni.trim()];
            await updateDoc(doc(db, 'users', user.id), {
                name: name.trim(), username: username || user.email.split('@')[0], dni: dni.trim(), phone: phone.trim(),
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                roles: selectedRoles, role: selectedRoles[0],
                assignedDivisionId: selectedDivisionId || null,
                assignedPlayerIds: selectedPlayerIds, keywords,
            });
            if (selectedRoles.includes('coach')) {
                const batch = writeBatch(db);
                const added = selectedCoachDivIds.filter(id => !initialCoachDivIds.includes(id));
                const removed = initialCoachDivIds.filter(id => !selectedCoachDivIds.includes(id));
                added.forEach(id => batch.update(doc(db, 'divisions', id), { coachIds: arrayUnion(user.id) }));
                removed.forEach(id => { if (id) batch.update(doc(db, 'divisions', id), { coachIds: arrayRemove(user.id) }); });
                await batch.commit();
            }
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="Email" value={user.email} disabled sx={{ mt: 2 }} />
                <TextField fullWidth label="Username" value={username} onChange={e => setUsername(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="DNI" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />
                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Roles</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {allowedRoles.map(role => (
                        <Chip key={role} label={RoleLabels[role] || role} color={selectedRoles.includes(role) ? 'primary' : 'default'} variant={selectedRoles.includes(role) ? 'filled' : 'outlined'} onClick={() => toggleRole(role)} size="small" />
                    ))}
                </Box>
                {(selectedRoles.includes('player') || selectedRoles.includes('manager')) && (
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Asignar División</InputLabel>
                        <Select value={selectedDivisionId} label="Asignar División" onChange={e => setSelectedDivisionId(e.target.value)}>
                            <MenuItem value="">Ninguna</MenuItem>
                            {activeDivisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.year})</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {selectedRoles.includes('coach') && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Divisiones (Entrenador)</Typography>
                        <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                            {activeDivisions.map(d => (
                                <ListItemButton key={d.id} dense onClick={() => setSelectedCoachDivIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}>
                                    <Checkbox checked={selectedCoachDivIds.includes(d.id)} size="small" />
                                    <ListItemText primary={d.name} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
                )}
                {selectedRoles.includes('parent') && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Asignar Hijos</Typography>
                        <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                            {players.map(p => (
                                <ListItemButton key={p.id} dense onClick={() => setSelectedPlayerIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                                    <Checkbox checked={selectedPlayerIds.includes(p.id)} size="small" />
                                    <ListItemText primary={p.name} secondary={`DNI: ${p.dni}`} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Block Edit Division Dialog ────────────────────────────────────
function BlockEditDivisionDialog({ division, onClose, onSuccess }) {
    const [name, setName] = useState(division.name);
    const [year, setYear] = useState(division.year.toString());
    const [selectedCoachIds, setSelectedCoachIds] = useState([...division.coachIds]);
    const [coaches, setCoaches] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, 'users'), where('roles', 'array-contains', 'coach')), snap => {
            setCoaches(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
        });
        return unsub;
    }, []);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'divisions', division.id), { name: name.trim(), coachIds: selectedCoachIds, year: parseInt(year) || division.year });
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar División</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="Camada (Año)" value={year} onChange={e => setYear(e.target.value)} type="number" sx={{ mt: 2 }} />
                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Asignar Entrenadores</Typography>
                <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                    {coaches.map(c => (
                        <ListItemButton key={c.id} dense onClick={() => setSelectedCoachIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}>
                            <Checkbox checked={selectedCoachIds.includes(c.id)} size="small" />
                            <ListItemText primary={c.name} />
                        </ListItemButton>
                    ))}
                    {coaches.length === 0 && <Typography sx={{ p: 1 }} variant="body2" color="text.secondary">No hay entrenadores</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Block Edit Player Dialog ──────────────────────────────────────
function BlockEditPlayerDialog({ player, allowedDivisionIds, onClose, onSuccess }) {
    const [name, setName] = useState(player.name);
    const [dni, setDni] = useState(player.dni);
    const [birthDate, setBirthDate] = useState(player.birthDate ? player.birthDate.toISOString().split('T')[0] : '');
    const [divisionId, setDivisionId] = useState(player.divisionId);
    const [divisions, setDivisions] = useState([]);
    const [clubFeePayments, setClubFeePayments] = useState({ ...player.clubFeePayments });
    const [paidYears, setPaidYears] = useState([...player.paidPlayerRightsYears]);
    const [loading, setLoading] = useState(false);

    const currentYear = new Date().getFullYear();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'divisions'), snap => {
            setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })).filter(d => allowedDivisionIds.includes(d.id) && !d.isHidden).sort((a, b) => a.name.localeCompare(b.name)));
        });
        return unsub;
    }, [allowedDivisionIds]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const data = { name: name.trim(), dni: dni.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null, divisionId, clubFeePayments, paidPlayerRightsYears: paidYears };
            await updateDoc(doc(db, 'players', player.id), data);
            if (player.userId) {
                try { await updateDoc(doc(db, 'users', player.userId), { name: name.trim(), dni: dni.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : null }); } catch (e) { console.log('Linked user update:', e); }
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
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                        return (
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
        </Dialog>
    );
}
// ─── Player Profile Dialog (View Only) ─────────────────────────────
function PlayerProfileDialog({ player, division, onClose }) {
    const currentYear = new Date().getFullYear();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const payments = player.clubFeePayments || {};
    const paidYears = player.paidPlayerRightsYears || [];

    const calcAge = (bd) => {
        if (!bd) return '-';
        const d = bd instanceof Date ? bd : new Date(bd);
        const diff = Date.now() - d.getTime();
        return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    };

    const formatDate = (bd) => {
        if (!bd) return '-';
        const d = bd instanceof Date ? bd : new Date(bd);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48, fontSize: 20 }}>
                        {player.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>{player.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{division?.name} ({division?.year})</Typography>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                {/* Personal Data */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>Datos Personales</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">DNI</Typography>
                        <Typography variant="body2" fontWeight={500}>{player.dni || '-'}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Email</Typography>
                        <Typography variant="body2" fontWeight={500}>{player.email || '-'}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                        <Typography variant="body2" fontWeight={500}>{player.phone || '-'}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Fecha de Nacimiento</Typography>
                        <Typography variant="body2" fontWeight={500}>{formatDate(player.birthDate)} ({calcAge(player.birthDate)} años)</Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Club Fee Payments */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Cuotas del Club — {currentYear}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                    {months.map((m, i) => {
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                        const paid = !!payments[key];
                        return (
                            <Chip key={key} label={m.substring(0, 3)} size="small"
                                color={paid ? 'success' : 'default'}
                                variant={paid ? 'filled' : 'outlined'}
                                icon={paid ? <span style={{ fontSize: 12 }}>✓</span> : undefined}
                                sx={{ justifyContent: 'center' }}
                            />
                        );
                    })}
                </Box>
                <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        Pagadas: {months.filter((_, i) => payments[`${currentYear}-${String(i + 1).padStart(2, '0')}`]).length} / 12
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Player Rights */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Derecho de Jugador</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                        <Chip key={y} label={y} size="small"
                            color={paidYears.includes(y) ? 'success' : 'default'}
                            variant={paidYears.includes(y) ? 'filled' : 'outlined'}
                            icon={paidYears.includes(y) ? <span style={{ fontSize: 12 }}>✓</span> : undefined}
                        />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="outlined">Cerrar</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────
function getRoleColor(role) {
    const map = { admin: '#e53935', coach: '#43a047', player: '#8e24aa', parent: '#00897b', manager: '#1e88e5', block_admin: '#fb8c00' };
    return map[role] || '#757575';
}
