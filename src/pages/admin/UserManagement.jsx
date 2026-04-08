import { useState, useEffect, useMemo } from 'react';
import {
    Box, TextField, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText, ListItemAvatar, Avatar, IconButton, Typography,
    FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemButton, Snackbar, Alert,
    CircularProgress, Divider, Tooltip, InputAdornment
} from '@mui/material';
import { Edit, Delete, Search, PersonAdd, Add, Close } from '@mui/icons-material';
import { db, secondaryApp } from '../../config/firebase';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch, setDoc, orderBy, limit, startAfter, arrayUnion, arrayRemove } from 'firebase/firestore';
import { userModelFromMap, UserRole, RoleLabels, getDisplayName } from '../../models/UserModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { AddressModel } from '../../models/AddressModel';
import AddressDialog from '../../components/shared/AddressDialog';
import { deleteUser } from '../../services/firestoreService';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [searchField, setSearchField] = useState('Nombre');
    const [roleFilter, setRoleFilter] = useState('');
    const [divisions, setDivisions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(collection(db, 'users'), snap => {
            setUsers(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
        }));
        unsubs.push(onSnapshot(collection(db, 'divisions'), snap => {
            setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })));
        }));
        unsubs.push(onSnapshot(collection(db, 'players'), snap => {
            setPlayers(snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id })));
        }));
        return () => unsubs.forEach(u => u());
    }, []);

    const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d.name])), [divisions]);

    const filtered = useMemo(() => {
        let list = users;
        if (roleFilter) list = list.filter(u => u.roles.includes(roleFilter));
        if (searchText) {
            const q = searchText.toLowerCase();
            list = list.filter(u => {
                if (searchField === 'Nombre') return u.name.toLowerCase().includes(q);
                if (searchField === 'DNI') return (u.dni || '').toLowerCase().includes(q);
                if (searchField === 'Email') return u.email.toLowerCase().includes(q);
                if (searchField === 'División') {
                    const divName = divMap[u.assignedDivisionId] || '';
                    return divName.toLowerCase().includes(q);
                }
                return true;
            });
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [users, searchText, searchField, roleFilter, divMap]);

    const handleDelete = async (user) => {
        if (!window.confirm(`¿Estás seguro de que querés eliminar al usuario "${user.name}"?\nEsta acción no se puede deshacer.`)) return;
        try {
            await deleteUser(user.id);
            setSnack({ open: true, msg: 'Usuario eliminado', severity: 'success' });
        } catch (e) {
            console.error('Delete user error:', e);
            setSnack({ open: true, msg: 'Error al eliminar: ' + e.message, severity: 'error' });
        }
    };

    const roleFilters = [
        { value: '', label: 'Todos' },
        ...Object.entries(RoleLabels).filter(([k]) => k !== 'user').map(([k, v]) => ({ value: k, label: v }))
    ];

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField size="small" placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} sx={{ flex: 1, minWidth: 200 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment>, endAdornment: searchText && <InputAdornment position="end"><IconButton size="small" onClick={() => setSearchText('')}><Close fontSize="small" /></IconButton></InputAdornment> }} />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select value={searchField} onChange={e => setSearchField(e.target.value)}>
                        {['Nombre', 'DNI', 'Email', 'División'].map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setCreateOpen(true)}>Crear Usuario</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                {roleFilters.map(r => (
                    <Chip key={r.value} label={r.label} color={roleFilter === r.value ? 'primary' : 'default'} variant={roleFilter === r.value ? 'filled' : 'outlined'} onClick={() => setRoleFilter(r.value)} size="small" />
                ))}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{filtered.length} usuario(s)</Typography>
            <List>
                {filtered.map(u => (
                    <ListItem key={u.id} divider secondaryAction={
                        <Box>
                            <IconButton size="small" onClick={() => setEditUser(u)}><Edit fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDelete(u)}><Delete fontSize="small" /></IconButton>
                        </Box>
                    }>
                        <ListItemAvatar><Avatar sx={{ bgcolor: getRoleColor(u.roles[0]) }}>{u.name?.[0]?.toUpperCase() || '?'}</Avatar></ListItemAvatar>
                        <ListItemText
                            primary={getDisplayName(u) || 'Sin nombre'}
                            secondary={<>{u.email}<br />{u.roles.map(r => RoleLabels[r]).join(', ')}{u.assignedDivisionId && divMap[u.assignedDivisionId] ? ` • ${divMap[u.assignedDivisionId]}` : ''}</>}
                        />
                    </ListItem>
                ))}
            </List>
            <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} divisions={divisions} players={players} onSuccess={(msg) => { setCreateOpen(false); setSnack({ open: true, msg: msg || 'Usuario creado', severity: 'success' }); }} />
            {editUser && <EditUserDialog user={editUser} onClose={() => setEditUser(null)} divisions={divisions} players={players} onSuccess={() => { setEditUser(null); setSnack({ open: true, msg: 'Usuario actualizado', severity: 'success' }); }} />}
            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}><Alert severity={snack.severity}>{snack.msg}</Alert></Snackbar>
        </Box>
    );
}

function getRoleColor(role) {
    const map = { admin: '#e53935', coach: '#43a047', player: '#8e24aa', parent: '#00897b', manager: '#1e88e5', block_admin: '#fb8c00' };
    return map[role] || '#757575';
}

function CreateUserDialog({ open, onClose, divisions, players, onSuccess }) {
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [dni, setDni] = useState('');
    const [phone, setPhone] = useState('');
    const [obraSocial, setObraSocial] = useState('');
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [selectedRoles, setSelectedRoles] = useState(['player']);
    const [selectedDivisionId, setSelectedDivisionId] = useState('');
    const [selectedManagerDivIds, setSelectedManagerDivIds] = useState([]);
    const [selectedCoachDivIds, setSelectedCoachDivIds] = useState([]);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
    const [selectedBlockId, setSelectedBlockId] = useState('');
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addressOpen, setAddressOpen] = useState(false);
    const [userAddress, setUserAddress] = useState(null);

    useEffect(() => {
        if (!open) return;
        // Reset form fields when dialog opens
        setName(''); setNickname(''); setEmail(''); setDni(''); setPhone(''); setBirthDate('');
        setObraSocial(''); setEmergencyContactName(''); setEmergencyContactPhone('');
        setSelectedRoles(['player']); setSelectedDivisionId(''); setSelectedCoachDivIds([]); setSelectedManagerDivIds([]);
        setSelectedPlayerIds([]); setSelectedBlockId(''); setLoading(false); setUserAddress(null);
        const unsub = onSnapshot(collection(db, 'blocks'), snap => {
            setBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, [open]);

    const activeDivisions = divisions.filter(d => !d.isHidden).sort((a, b) => { const n = a.name.match(/\d+/); const m = b.name.match(/\d+/); if (n && m) return parseInt(n[0]) - parseInt(m[0]); return a.name.localeCompare(b.name); });

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
        if (selectedRoles.includes('player') && !selectedDivisionId) { alert('División es requerida'); return; }
        if (selectedRoles.includes('manager') && selectedManagerDivIds.length === 0) { alert('División es requerida'); return; }
        if (selectedRoles.includes('block_admin') && !selectedBlockId) { alert('Bloque es requerido'); return; }
        setLoading(true);
        try {
            const existingEmail = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
            if (!existingEmail.empty) { alert('Este email ya está registrado'); setLoading(false); return; }
            const existingDni = await getDocs(query(collection(db, 'users'), where('dni', '==', dni.trim())));
            if (!existingDni.empty) { alert('Este DNI ya está registrado'); setLoading(false); return; }
            // Managers allow multiple divisions logic handled by UI now
            const secondaryAuth = getAuth(secondaryApp);
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), dni.trim());
            const userId = cred.user.uid;
            await secondaryAuth.signOut();
            const username = email.trim().split('@')[0];
            const nameLower = name.trim().toLowerCase();
            const nicknameLower = nickname.trim().toLowerCase();
            const keywords = [...nameLower.split(' '), email.trim().toLowerCase(), username, dni.trim()];
            if (nicknameLower) {
                keywords.push(nicknameLower);
                keywords.push(...nicknameLower.split(' '));
            }

            let addressId = null;
            if (userAddress) {
                const docRef = doc(collection(db, 'addresses'));
                addressId = docRef.id;
                userAddress.id = addressId;
                await setDoc(docRef, userAddress.toMap());
            }

            await setDoc(doc(db, 'users', userId), {
                id: userId, name: name.trim(), nickname: nickname.trim(), email: email.trim(), username, dni: dni.trim(), phone: phone.trim(),
                obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(),
                addressId,
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                role: selectedRoles[0], roles: selectedRoles,
                assignedDivisionId: selectedRoles.includes('manager') ? (selectedManagerDivIds.length > 0 ? selectedManagerDivIds[0] : null) : (selectedDivisionId || null),
                assignedDivisionIds: selectedRoles.includes('manager') ? selectedManagerDivIds : [],
                assignedBlockId: selectedBlockId || null,
                assignedPlayerIds: selectedPlayerIds,
                createdAt: new Date(), keywords,
            });
            if (selectedRoles.includes('player') && selectedDivisionId) {
                const playerRef = doc(collection(db, 'players'));
                await setDoc(playerRef, {
                    id: playerRef.id, name: name.trim(), nickname: nickname.trim(), divisionId: selectedDivisionId, dni: dni.trim(),
                    userId, birthDate: new Date(birthDate).toISOString(), phone: phone.trim(), email: email.trim(),
                    obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(),
                    addressId,
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
                <TextField fullWidth label="Nombre y Apellido *" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="Apodo (Opcional)" value={nickname} onChange={e => setNickname(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Email *" value={email} onChange={e => setEmail(e.target.value)} type="email" sx={{ mt: 2 }} />
                <TextField fullWidth label="DNI (Contraseña inicial) *" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} helperText="El DNI será usado como contraseña inicial" />
                <TextField fullWidth label="Teléfono *" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Obra Social (Opcional)" value={obraSocial} onChange={e => setObraSocial(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Nombre) (Opcional)" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Teléfono) (Opcional)" value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} helperText={selectedRoles.includes('player') ? 'Requerido para jugadores' : ''} />

                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button variant="outlined" onClick={() => setAddressOpen(true)} startIcon={<Add />}>
                        {userAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                    </Button>
                    {userAddress && (
                        <Typography variant="caption" color="text.secondary">
                            {userAddress.calle} {userAddress.numero}{userAddress.departamento ? ` Dpto: ${userAddress.departamento}` : ''}, {userAddress.localidad}
                        </Typography>
                    )}
                </Box>

                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Roles</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {Object.entries(RoleLabels).filter(([k]) => k !== 'user').map(([role, label]) => (
                        <Chip key={role} label={label} color={selectedRoles.includes(role) ? 'primary' : 'default'} variant={selectedRoles.includes(role) ? 'filled' : 'outlined'} onClick={() => toggleRole(role)} size="small" />
                    ))}
                </Box>
                {selectedRoles.includes('player') && (
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Asignar División *</InputLabel>
                        <Select value={selectedDivisionId} label="Asignar División *" onChange={e => setSelectedDivisionId(e.target.value)}>
                            {activeDivisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.year})</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {selectedRoles.includes('manager') && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Asignar Divisiones (Manager)</Typography>
                        <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                            {activeDivisions.map(d => (
                                <ListItemButton key={d.id} dense onClick={() => setSelectedManagerDivIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}>
                                    <Checkbox checked={selectedManagerDivIds.includes(d.id)} size="small" />
                                    <ListItemText primary={d.name} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
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
                                    <ListItemText primary={p.nickname ? `"${p.nickname}" ${p.name}` : p.name} secondary={`DNI: ${p.dni}`} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
                )}
                {selectedRoles.includes('block_admin') && (
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Asignar Bloque *</InputLabel>
                        <Select value={selectedBlockId} label="Asignar Bloque *" onChange={e => setSelectedBlockId(e.target.value)}>
                            {blocks.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {email && <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Username automático: {email.split('@')[0]}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleCreate} variant="contained" disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Crear'}</Button>
            </DialogActions>

            <AddressDialog
                open={addressOpen}
                initialAddress={userAddress}
                onClose={() => setAddressOpen(false)}
                onSave={(addr) => setUserAddress(addr)}
            />
        </Dialog>
    );
}

function EditUserDialog({ user, onClose, divisions, players, onSuccess }) {
    const [name, setName] = useState(user.name);
    const [nickname, setNickname] = useState(user.nickname || '');
    const [username, setUsername] = useState(user.username);
    const [dni, setDni] = useState(user.dni || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [obraSocial, setObraSocial] = useState(user.obraSocial || '');
    const [emergencyContactName, setEmergencyContactName] = useState(user.emergencyContactName || '');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState(user.emergencyContactPhone || '');
    const [birthDate, setBirthDate] = useState(user.birthDate ? user.birthDate.toISOString().split('T')[0] : '');
    const [selectedRoles, setSelectedRoles] = useState([...user.roles]);
    const [selectedDivisionId, setSelectedDivisionId] = useState(user.assignedDivisionId || '');
    const [selectedManagerDivIds, setSelectedManagerDivIds] = useState(user.assignedDivisionIds?.length > 0 ? user.assignedDivisionIds : (user.assignedDivisionId ? [user.assignedDivisionId] : []));
    const [selectedCoachDivIds, setSelectedCoachDivIds] = useState([]);
    const [initialCoachDivIds, setInitialCoachDivIds] = useState([]);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([...user.assignedPlayerIds]);
    const [selectedBlockId, setSelectedBlockId] = useState(user.assignedBlockId || '');
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [addressOpen, setAddressOpen] = useState(false);
    const [userAddress, setUserAddress] = useState(null);

    const activeDivisions = divisions.filter(d => !d.isHidden);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'blocks'), snap => setBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        if (user.roles.includes('coach')) {
            const coachDivs = divisions.filter(d => d.coachIds.includes(user.id)).map(d => d.id);
            setSelectedCoachDivIds(coachDivs);
            setInitialCoachDivIds(coachDivs);
        }
        if (user.addressId) {
            getDocs(query(collection(db, 'addresses'), where('__name__', '==', user.addressId))).then(snap => {
                if (!snap.empty) {
                    setUserAddress(AddressModel.fromMap(snap.docs[0].data(), snap.docs[0].id));
                }
            });
        }
        return unsub;
    }, []);

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
            const nicknameLower = nickname.trim().toLowerCase();
            const keywords = [...nameLower.split(' '), user.email.toLowerCase(), (username || user.email.split('@')[0]).toLowerCase(), dni.trim()];
            if (nicknameLower) {
                keywords.push(nicknameLower);
                keywords.push(...nicknameLower.split(' '));
            }

            let addressId = user.addressId || null;
            if (userAddress) {
                if (addressId) {
                    await updateDoc(doc(db, 'addresses', addressId), userAddress.toMap());
                } else {
                    const docRef = doc(collection(db, 'addresses'));
                    addressId = docRef.id;
                    userAddress.id = addressId;
                    await setDoc(docRef, userAddress.toMap());
                }
            }

            await updateDoc(doc(db, 'users', user.id), {
                name: name.trim(), nickname: nickname.trim(), username: username || user.email.split('@')[0], dni: dni.trim(), phone: phone.trim(),
                obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(),
                addressId,
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                roles: selectedRoles, role: selectedRoles[0],
                assignedDivisionId: selectedRoles.includes('manager') ? (selectedManagerDivIds.length > 0 ? selectedManagerDivIds[0] : null) : (selectedDivisionId || null),
                assignedDivisionIds: selectedRoles.includes('manager') ? selectedManagerDivIds : [],
                assignedBlockId: selectedBlockId || null,
                assignedPlayerIds: selectedPlayerIds,
                keywords,
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
                <TextField fullWidth label="Nombre y Apellido *" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="Apodo (Opcional)" value={nickname} onChange={e => setNickname(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Email" value={user.email} disabled sx={{ mt: 2 }} />
                <TextField fullWidth label="Username" value={username} onChange={e => setUsername(e.target.value)} sx={{ mt: 2 }} helperText={`Default: ${user.email.split('@')[0]}`} />
                <TextField fullWidth label="DNI" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Obra Social (Opcional)" value={obraSocial} onChange={e => setObraSocial(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Nombre) (Opcional)" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Teléfono) (Opcional)" value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />

                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button variant="outlined" onClick={() => setAddressOpen(true)} startIcon={<Add />}>
                        {userAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                    </Button>
                    {userAddress && (
                        <Typography variant="caption" color="text.secondary">
                            {userAddress.calle} {userAddress.numero}{userAddress.departamento ? ` Dpto: ${userAddress.departamento}` : ''}, {userAddress.localidad}
                        </Typography>
                    )}
                </Box>

                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Roles</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {Object.entries(RoleLabels).filter(([k]) => k !== 'user').map(([role, label]) => (
                        <Chip key={role} label={label} color={selectedRoles.includes(role) ? 'primary' : 'default'} variant={selectedRoles.includes(role) ? 'filled' : 'outlined'} onClick={() => toggleRole(role)} size="small" />
                    ))}
                </Box>
                {selectedRoles.includes('player') && (
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Asignar División</InputLabel>
                        <Select value={selectedDivisionId} label="Asignar División" onChange={e => setSelectedDivisionId(e.target.value)}>
                            <MenuItem value="">Ninguna</MenuItem>
                            {activeDivisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.year})</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {selectedRoles.includes('manager') && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Asignar Divisiones (Manager)</Typography>
                        <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                            {activeDivisions.map(d => (
                                <ListItemButton key={d.id} dense onClick={() => setSelectedManagerDivIds(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}>
                                    <Checkbox checked={selectedManagerDivIds.includes(d.id)} size="small" />
                                    <ListItemText primary={d.name} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
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
                                    <ListItemText primary={p.nickname ? `"${p.nickname}" ${p.name}` : p.name} secondary={`DNI: ${p.dni}`} />
                                </ListItemButton>
                            ))}
                        </Box>
                    </Box>
                )}
                {selectedRoles.includes('block_admin') && (
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Asignar Bloque</InputLabel>
                        <Select value={selectedBlockId} label="Asignar Bloque" onChange={e => setSelectedBlockId(e.target.value)}>
                            <MenuItem value="">Ninguno</MenuItem>
                            {blocks.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                )}

                <Divider sx={{ my: 3 }} />
                <Box sx={{ p: 2, bgcolor: 'error.lighter', borderRadius: 2, border: 1, borderColor: 'error.light' }}>
                    <Typography variant="subtitle2" color="error.main" fontWeight={700}>Zona de Peligro</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Envía un enlace oficial para que el usuario pueda restablecer su contraseña de forma segura.
                    </Typography>
                    <Button 
                        variant="outlined" 
                        color="primary" 
                        size="small" 
                        onClick={async () => {
                            if (window.confirm(`¿Enviar email de recuperación a ${user.email}?`)) {
                                try {
                                    const authObj = getAuth();
                                    await sendPasswordResetEmail(authObj, user.email);
                                    alert('Email de recuperación enviado con éxito.');
                                } catch (e) {
                                    alert('Error al enviar email: ' + e.message);
                                }
                            }
                        }}
                    >
                        Enviar Email de Recuperación
                    </Button>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
            </DialogActions>

            <AddressDialog
                open={addressOpen}
                initialAddress={userAddress}
                onClose={() => setAddressOpen(false)}
                onSave={(addr) => setUserAddress(addr)}
            />
        </Dialog>
    );
}
