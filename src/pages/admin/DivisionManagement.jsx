import { useState, useEffect } from 'react';
import {
    Box, Card, Typography, IconButton, Button, TextField, Dialog, DialogTitle, DialogContent,
    DialogActions, Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemAvatar,
    ListItemText, Avatar, Chip, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
    Snackbar, Alert, Divider, Checkbox, ListItemButton, Tooltip, CircularProgress
} from '@mui/material';
import {
    ExpandMore, Edit, Delete, Restore, Shield, CalendarMonth, Add, VisibilityOff, PersonAdd, Visibility
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { db, secondaryApp } from '../../config/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch, setDoc, arrayRemove } from 'firebase/firestore';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import { userModelFromMap, RoleLabels, getDisplayName } from '../../models/UserModel';
import { AddressModel } from '../../models/AddressModel';
import AddressDialog from '../../components/shared/AddressDialog';
import PlayerAttendanceDialog from '../../components/shared/PlayerAttendanceDialog';

function naturalSort(a, b) {
    const re = /(\d+)/g;
    const aParts = a.split(re), bParts = b.split(re);
    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        if (i % 2 === 1) { const diff = parseInt(aParts[i]) - parseInt(bParts[i]); if (diff !== 0) return diff; }
        else { const diff = aParts[i].localeCompare(bParts[i]); if (diff !== 0) return diff; }
    }
    return aParts.length - bParts.length;
}

export default function DivisionManagement() {
    const navigate = useNavigate();
    const [divisions, setDivisions] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [showHidden, setShowHidden] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
    const [createOpen, setCreateOpen] = useState(false);
    const [editDiv, setEditDiv] = useState(null);
    const [editPlayer, setEditPlayer] = useState(null);
    const [addTypeDialog, setAddTypeDialog] = useState(null);
    const [newTypeName, setNewTypeName] = useState('');
    const [createPlayerDiv, setCreatePlayerDiv] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'divisions'), (snap) => {
            setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })));
        });
        return unsub;
    }, []);

    const filtered = divisions
        .filter(d => showHidden || !d.isHidden)
        .filter(d => !selectedYear || d.year === parseInt(selectedYear))
        .sort((a, b) => { const yc = b.year - a.year; return yc !== 0 ? yc : naturalSort(a.name, b.name); });

    const years = [...new Set(divisions.map(d => d.year))].sort((a, b) => b - a);

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
                    const blocksSnap = await getDocs(collection(db, 'blocks'));
                    const batch = writeBatch(db);
                    blocksSnap.docs.forEach(d => {
                        const bData = d.data();
                        if (bData.divisionIds && bData.divisionIds.includes(div.id)) {
                            batch.update(d.ref, { divisionIds: arrayRemove(div.id) });
                        }
                    });
                    await batch.commit();
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

    const handleAddCustomType = async () => {
        if (!newTypeName.trim() || !addTypeDialog) return;
        try {
            const updated = [...(addTypeDialog.customAttendanceTypes || []), newTypeName.trim()];
            await updateDoc(doc(db, 'divisions', addTypeDialog.id), { customAttendanceTypes: updated });
            setSnack({ open: true, msg: `Tipo "${newTypeName.trim()}" agregado`, severity: 'success' });
            setNewTypeName('');
            setAddTypeDialog(null);
        } catch (e) {
            setSnack({ open: true, msg: 'Error: ' + e.message, severity: 'error' });
        }
    };

    const handleRemoveCustomType = async (div, type) => {
        try {
            const attSnap = await getDocs(query(collection(db, 'attendance'), where('divisionId', '==', div.id), where('type', '==', type)));
            if (!attSnap.empty) {
                alert(`No se puede eliminar "${type}" porque tiene ${attSnap.size} asistencia(s) registrada(s).`);
                return;
            }
            const updated = (div.customAttendanceTypes || []).filter(t => t !== type);
            await updateDoc(doc(db, 'divisions', div.id), { customAttendanceTypes: updated });
            setSnack({ open: true, msg: `Tipo "${type}" eliminado`, severity: 'success' });
        } catch (e) {
            setSnack({ open: true, msg: 'Error: ' + e.message, severity: 'error' });
        }
    };

    return (
        <Box>
            <Typography variant="h5" fontWeight={800} gutterBottom>Gestión de Divisiones</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Filtrar por Camada</InputLabel>
                    <Select value={selectedYear} label="Filtrar por Camada" onChange={e => setSelectedYear(e.target.value)}>
                        <MenuItem value="">Todas las Camadas</MenuItem>
                        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControlLabel control={<Switch checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />} label="Mostrar Ocultas" />
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Crear División</Button>
            </Box>

            {filtered.length === 0 && <Typography color="text.secondary">No hay divisiones para mostrar.</Typography>}

            {filtered.map(div => (
                <Accordion key={div.id} sx={{ mb: 1, opacity: div.isHidden ? 0.6 : 1, bgcolor: div.isHidden ? 'action.hover' : 'background.paper' }}>
                    <AccordionSummary expandIcon={<ExpandMore />} component="div" sx={{ cursor: 'pointer' }}>
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
                                    <IconButton size="small" color="info" onClick={() => navigate(`/coach/attendance-history/${div.id}`)}>
                                        <CalendarMonth fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Editar"><IconButton size="small" onClick={() => setEditDiv(div)}><Edit fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title={div.isHidden ? 'Restaurar' : 'Ocultar/Eliminar'}>
                                    <IconButton size="small" color={div.isHidden ? 'success' : 'error'} onClick={() => div.isHidden ? handleRestore(div) : handleHideOrDelete(div)}>
                                        {div.isHidden ? <Restore fontSize="small" /> : <Delete fontSize="small" />}
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        {/* Custom Attendance Types */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>Tipos de Asistencia:</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5, alignItems: 'center' }}>
                                <Chip label="Entrenamiento" size="small" color="primary" variant="outlined" />
                                <Chip label="Partido" size="small" color="secondary" variant="outlined" />
                                {(div.customAttendanceTypes || []).map(t => (
                                    <Chip key={t} label={t} size="small" variant="outlined" onDelete={() => handleRemoveCustomType(div, t)} />
                                ))}
                                <Chip icon={<Add />} label="Agregar" size="small" variant="outlined" color="primary" clickable
                                    onClick={() => { setAddTypeDialog(div); setNewTypeName(''); }} />
                            </Box>
                        </Box>
                        <Divider sx={{ mb: 1 }} />
                        <DivisionPlayerList division={div} onEditPlayer={setEditPlayer} onCreatePlayer={() => setCreatePlayerDiv(div)} snack={setSnack} />
                    </AccordionDetails>
                </Accordion>
            ))}

            {/* Add custom type dialog */}
            <Dialog open={!!addTypeDialog} onClose={() => setAddTypeDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Agregar Tipo de Asistencia</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Nombre del tipo (ej: Protector Bucal)" value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                        sx={{ mt: 1 }} onKeyDown={e => e.key === 'Enter' && handleAddCustomType()} autoFocus />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddTypeDialog(null)} color="inherit">Cancelar</Button>
                    <Button onClick={handleAddCustomType} variant="contained" disabled={!newTypeName.trim()}>Agregar</Button>
                </DialogActions>
            </Dialog>

            <CreateDivisionDialog open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => { setCreateOpen(false); setSnack({ open: true, msg: 'División creada', severity: 'success' }); }} />
            {editDiv && <EditDivisionDialog division={editDiv} onClose={() => setEditDiv(null)} onSuccess={() => { setEditDiv(null); setSnack({ open: true, msg: 'División actualizada', severity: 'success' }); }} />}
            {editPlayer && <EditPlayerDialog player={editPlayer} onClose={() => setEditPlayer(null)} onSuccess={() => { setEditPlayer(null); setSnack({ open: true, msg: 'Jugador actualizado', severity: 'success' }); }} />}
            {createPlayerDiv && <CreatePlayerDialog division={createPlayerDiv} onClose={() => setCreatePlayerDiv(null)} onSuccess={() => { setCreatePlayerDiv(null); setSnack({ open: true, msg: 'Jugador creado exitosamente', severity: 'success' }); }} />}
            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
            </Snackbar>
        </Box>
    );
}

function DivisionSubtitle({ div }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, 'players'), where('divisionId', '==', div.id)), snap => setCount(snap.size));
        return unsub;
    }, [div.id]);
    return <Typography variant="body2" color="text.secondary">Entrenadores: {div.coachIds.length} | Jugadores: {count}</Typography>;
}

function DivisionPlayerList({ division, onEditPlayer, onCreatePlayer, snack }) {
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
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>{p.nickname ? `"${p.nickname}" ${p.name}` : p.name}</Typography>
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
            {viewPlayer && <AdminPlayerProfileDialog player={viewPlayer} division={division} onClose={() => setViewPlayer(null)} />}
        </Box>
    );
}

function CreateDivisionDialog({ open, onClose, onSuccess }) {
    const [name, setName] = useState('');
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [coaches, setCoaches] = useState([]);
    const [managers, setManagers] = useState([]);
    const [selectedCoachIds, setSelectedCoachIds] = useState([]);
    const [selectedManagerIds, setSelectedManagerIds] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        const unsubs = [];
        unsubs.push(onSnapshot(query(collection(db, 'users'), where('roles', 'array-contains', 'coach')), snap => {
            setCoaches(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
        }));
        unsubs.push(onSnapshot(query(collection(db, 'users'), where('roles', 'array-contains', 'manager')), snap => {
            setManagers(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
        }));
        return () => unsubs.forEach(u => u());
    }, [open]);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const ref = doc(collection(db, 'divisions'));
            await setDoc(ref, { id: ref.id, name: name.trim(), coachIds: selectedCoachIds, year: parseInt(year) || new Date().getFullYear(), isHidden: false, customAttendanceTypes: [] });
            if (selectedManagerIds.length > 0) {
                const batch = writeBatch(db);
                selectedManagerIds.forEach(id => batch.update(doc(db, 'users', id), { assignedDivisionId: ref.id }));
                await batch.commit();
            }
            setName(''); setYear(new Date().getFullYear().toString()); setSelectedCoachIds([]); setSelectedManagerIds([]);
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
                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Asignar Managers</Typography>
                <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                    {managers.map(m => (
                        <ListItemButton key={m.id} dense onClick={() => setSelectedManagerIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}>
                            <Checkbox checked={selectedManagerIds.includes(m.id)} size="small" />
                            <ListItemText primary={m.name} secondary={m.assignedDivisionId ? '(Asignado a otra división)' : null} secondaryTypographyProps={{ color: 'warning.main', fontSize: 11 }} />
                        </ListItemButton>
                    ))}
                    {managers.length === 0 && <Typography sx={{ p: 1 }} variant="body2" color="text.secondary">No hay managers</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleCreate} variant="contained" disabled={loading}>{loading ? 'Creando...' : 'Crear'}</Button>
            </DialogActions>
        </Dialog>
    );
}

function EditDivisionDialog({ division, onClose, onSuccess }) {
    const [name, setName] = useState(division.name);
    const [year, setYear] = useState(division.year.toString());
    const [selectedCoachIds, setSelectedCoachIds] = useState([...division.coachIds]);
    const [selectedManagerIds, setSelectedManagerIds] = useState([]);
    const [originalManagerIds, setOriginalManagerIds] = useState([]);
    const [coaches, setCoaches] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [managersLoaded, setManagersLoaded] = useState(false);

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(query(collection(db, 'users'), where('roles', 'array-contains', 'coach')), snap => {
            setCoaches(snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id })));
        }));
        unsubs.push(onSnapshot(query(collection(db, 'users'), where('roles', 'array-contains', 'manager')), snap => {
            const mgrs = snap.docs.map(d => userModelFromMap({ ...d.data(), id: d.id }));
            setManagers(mgrs);
            if (!managersLoaded) {
                const assigned = mgrs.filter(m => m.assignedDivisionId === division.id).map(m => m.id);
                setSelectedManagerIds(assigned);
                setOriginalManagerIds(assigned);
                setManagersLoaded(true);
            }
        }));
        return () => unsubs.forEach(u => u());
    }, [division.id]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'divisions', division.id), { name: name.trim(), coachIds: selectedCoachIds, year: parseInt(year) || division.year });
            const addedMgrs = selectedManagerIds.filter(id => !originalManagerIds.includes(id));
            const removedMgrs = originalManagerIds.filter(id => !selectedManagerIds.includes(id));
            addedMgrs.forEach(id => batch.update(doc(db, 'users', id), { assignedDivisionId: division.id }));
            removedMgrs.forEach(id => batch.update(doc(db, 'users', id), { assignedDivisionId: null }));
            await batch.commit();
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
                </Box>
                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Asignar Managers</Typography>
                <Box sx={{ maxHeight: 150, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 0.5 }}>
                    {managers.map(m => (
                        <ListItemButton key={m.id} dense onClick={() => setSelectedManagerIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}>
                            <Checkbox checked={selectedManagerIds.includes(m.id)} size="small" />
                            <ListItemText primary={m.name} secondary={m.assignedDivisionId && m.assignedDivisionId !== division.id ? '(Asignado a otra división)' : null} />
                        </ListItemButton>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
            </DialogActions>
        </Dialog>
    );
}

function EditPlayerDialog({ player, onClose, onSuccess }) {
    const [name, setName] = useState(player.name);
    const [nickname, setNickname] = useState(player.nickname || '');
    const [dni, setDni] = useState(player.dni || '');
    const [obraSocial, setObraSocial] = useState(player.obraSocial || '');
    const [emergencyContactName, setEmergencyContactName] = useState(player.emergencyContactName || '');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState(player.emergencyContactPhone || '');
    const [birthDate, setBirthDate] = useState(player.birthDate ? player.birthDate.toISOString().split('T')[0] : '');
    const [divisionId, setDivisionId] = useState(player.divisionId);
    const [divisions, setDivisions] = useState([]);
    const [clubFeePayments, setClubFeePayments] = useState({ ...player.clubFeePayments });
    const [paidYears, setPaidYears] = useState([...player.paidPlayerRightsYears]);
    const [notes, setNotes] = useState([...(player.notes || [])]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [addressOpen, setAddressOpen] = useState(false);
    const [playerAddress, setPlayerAddress] = useState(null);

    const currentYear = new Date().getFullYear();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'divisions'), snap => {
            setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })).filter(d => !d.isHidden).sort((a, b) => b.year - a.year));
        });
        if (player.addressId) {
            getDocs(query(collection(db, 'addresses'), where('__name__', '==', player.addressId))).then(snap => {
                if (!snap.empty) {
                    setPlayerAddress(AddressModel.fromMap(snap.docs[0].data(), snap.docs[0].id));
                }
            });
        }
        return unsub;
    }, []);

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
                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>División</InputLabel>
                    <Select value={divisionId} label="División" onChange={e => setDivisionId(e.target.value)}>
                        {divisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.year})</MenuItem>)}
                    </Select>
                </FormControl>

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
        </Dialog>
    );
}

function CreatePlayerDialog({ division, onClose, onSuccess }) {
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
                addressId,
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
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
                addressId,
                birthDate: birthDate ? new Date(birthDate).toISOString() : null,
                divisionId: division.id,
                clubFeePayments: {},
                paidPlayerRightsYears: [],
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
                    <Button variant="outlined" onClick={() => setAddressOpen(true)} startIcon={<Add />}>
                        {playerAddress ? 'Editar Dirección' : 'Cargar Dirección'}
                    </Button>
                    {playerAddress && (
                        <Typography variant="caption" color="text.secondary">
                            {playerAddress.calle} {playerAddress.numero}{playerAddress.departamento ? ` Dpto: ${playerAddress.departamento}` : ''}, {playerAddress.localidad}
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
                onSave={(addr) => setPlayerAddress(addr)}
            />
        </Dialog>
    );
}

// ─── Player Profile Dialog (View Only) ─────────────────────────────
function AdminPlayerProfileDialog({ player, division, onClose }) {
    const currentYear = new Date().getFullYear();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const payments = player.clubFeePayments || {};
    const paidYears = player.paidPlayerRightsYears || [];
    const [address, setAddress] = useState(null);
    const [attendanceOpen, setAttendanceOpen] = useState(false);

    useEffect(() => {
        if (player.addressId) {
            getDoc(doc(db, 'addresses', player.addressId)).then(snap => {
                if (snap.exists()) setAddress(snap.data());
            }).catch(console.error);
        }
    }, [player.addressId]);

    const calcAge = (bd) => {
        if (!bd) return '-';
        const d = bd instanceof Date ? bd : new Date(bd);
        return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
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
                    <Box>
                        <Typography variant="caption" color="text.secondary">Obra Social</Typography>
                        <Typography variant="body2" fontWeight={500}>{player.obraSocial || '-'}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Contacto de Emergencia</Typography>
                        <Typography variant="body2" fontWeight={500}>{player.emergencyContactName ? `${player.emergencyContactName} (${player.emergencyContactPhone || '-'})` : '-'}</Typography>
                    </Box>
                    <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography variant="caption" color="text.secondary">Dirección</Typography>
                        <Typography variant="body2" fontWeight={500}>
                            {address ? `${address.calle} ${address.numero}${address.departamento ? ` Dpto: ${address.departamento}` : ''}, ${address.localidad}` : '-'}
                        </Typography>
                    </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Cuotas del Club — {currentYear}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
                    {months.map((m, i) => {
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                        const paid = !!payments[key];
                        return (
                            <Chip key={key} label={m.substring(0, 3)} size="small"
                                color={paid ? 'success' : 'default'} variant={paid ? 'filled' : 'outlined'}
                                icon={paid ? <span style={{ fontSize: 12 }}>✓</span> : undefined}
                                sx={{ justifyContent: 'center' }} />
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
                        <Chip key={y} label={y} size="small"
                            color={paidYears.includes(y) ? 'success' : 'default'} variant={paidYears.includes(y) ? 'filled' : 'outlined'}
                            icon={paidYears.includes(y) ? <span style={{ fontSize: 12 }}>✓</span> : undefined} />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setAttendanceOpen(true)} variant="contained" color="primary">Ver Asistencias</Button>
                <Button onClick={onClose} variant="outlined">Cerrar</Button>
            </DialogActions>
            {attendanceOpen && <PlayerAttendanceDialog open={attendanceOpen} player={player} onClose={() => setAttendanceOpen(false)} />}
        </Dialog>
    );
}
