import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import {
    Box, Typography, FormControl, InputLabel, Select, MenuItem,
    TextField, Grid, Fade, Accordion, AccordionSummary, AccordionDetails,
    List, ListItem, ListItemIcon, ListItemText, IconButton, Divider,
    Button, Chip
} from '@mui/material';
import {
    CheckCircle as PresentIcon, Cancel as AbsentIcon, AccessTime as LateIcon,
    ExpandMore, ArrowBack, Notes as NotesIcon, FilterAltOff, Edit as EditIcon, Delete as DeleteIcon
} from '@mui/icons-material';

export default function AttendanceHistory({ allowedDivisionIds }) {
    const { userModel, activeRole } = useAuth();
    const { divisionId } = useParams();
    const navigate = useNavigate();
    const [divisions, setDivisions] = useState([]);
    const [selectedDivision, setSelectedDivision] = useState(divisionId || '');
    const [attendance, setAttendance] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Fetch divisions scoped to role
    useEffect(() => {
        const isAdmin = activeRole === 'admin';
        const isBlockAdmin = activeRole === 'block_admin';
        const unsub = onSnapshot(collection(db, 'divisions'), snap => {
            let divs = snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })).filter(d => !d.isHidden);

            if (isAdmin) {
                // admin sees all
            } else if (isBlockAdmin) {
                if (allowedDivisionIds) {
                    divs = divs.filter(d => allowedDivisionIds.includes(d.id));
                } else if (divisionId) {
                    divs = divs.filter(d => d.id === divisionId);
                } else {
                    divs = [];
                }
            } else if (activeRole === 'manager') {
                const mgrDivIds = [];
                if (userModel?.assignedDivisionIds?.length > 0) {
                    mgrDivIds.push(...userModel.assignedDivisionIds);
                } else if (userModel?.assignedDivisionId) {
                    mgrDivIds.push(userModel.assignedDivisionId);
                }

                if (mgrDivIds.length > 0) {
                    divs = divs.filter(d => mgrDivIds.includes(d.id));
                } else {
                    divs = [];
                }
            } else {
                if (userModel?.id) {
                    divs = divs.filter(d => d.coachIds?.includes(userModel.id));
                }
            }
            divs.sort((a, b) => a.name.localeCompare(b.name));
            setDivisions(divs);
            // If URL has divisionId, keep it. Otherwise show all.
            if (divisionId && divs.some(d => d.id === divisionId)) {
                setSelectedDivision(divisionId);
            }
        });
        return unsub;
    }, [userModel, allowedDivisionIds, divisionId]);

    // Fetch attendance: if a division is selected, fetch that one only. Otherwise fetch all coach divisions.
    useEffect(() => {
        if (divisions.length === 0) return;
        const divIds = selectedDivision ? [selectedDivision] : divisions.map(d => d.id);
        if (divIds.length === 0) return;

        // Firestore 'in' supports max 30 items, batch if needed
        const batches = [];
        for (let i = 0; i < divIds.length; i += 30) {
            batches.push(divIds.slice(i, i + 30));
        }

        const allAttendance = [];
        const unsubs = [];

        batches.forEach((batch, batchIdx) => {
            unsubs.push(onSnapshot(
                query(collection(db, 'attendance'), where('divisionId', 'in', batch)),
                snap => {
                    const records = snap.docs.map(d => {
                        const data = d.data();
                        return { id: d.id, ...data, date: data.date?.toDate ? data.date.toDate() : new Date(data.date) };
                    });
                    // Merge into allAttendance by replacing this batch's records
                    allAttendance[batchIdx] = records;
                    setAttendance(allAttendance.flat().filter(Boolean));
                }
            ));
        });

        // Also fetch players for all relevant divisions
        batches.forEach(batch => {
            unsubs.push(onSnapshot(
                query(collection(db, 'players'), where('divisionId', 'in', batch)),
                snap => setAllPlayers(prev => {
                    const newPlayers = snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id }));
                    const otherPlayers = prev.filter(p => !batch.includes(p.divisionId));
                    return [...otherPlayers, ...newPlayers];
                })
            ));
        });

        return () => unsubs.forEach(u => u());
    }, [selectedDivision, divisions]);

    const playersMap = useMemo(() => Object.fromEntries(allPlayers.map(p => [p.id, p])), [allPlayers]);
    const divsMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d])), [divisions]);

    const filtered = useMemo(() => {
        return attendance
            .filter(a => {
                if (dateFrom && a.date < new Date(dateFrom)) return false;
                if (dateTo && a.date > new Date(dateTo + 'T23:59:59')) return false;
                return true;
            })
            .sort((a, b) => b.date - a.date);
    }, [attendance, dateFrom, dateTo]);

    const translateType = (type) => {
        if (type === 'training') return 'Entrenamiento';
        if (type === 'match') return 'Partido';
        return type;
    };

    const hasActiveFilter = selectedDivision || dateFrom || dateTo;
    const selectedDivName = divisions.find(d => d.id === selectedDivision)?.name || '';
    const showAllDivisions = !selectedDivision && divisions.length > 1;

    const resetFilters = () => {
        setSelectedDivision('');
        setDateFrom('');
        setDateTo('');
    };

    const handleAddObservation = async (recordId, text) => {
        if (!text.trim()) return;
        try {
            await updateDoc(doc(db, 'attendance', recordId), {
                observations: arrayUnion({
                    text: text.trim(),
                    date: new Date().toISOString(),
                    authorName: userModel?.name || 'Usuario'
                })
            });
        } catch (e) {
            console.error("Error adding observation:", e);
        }
    };


    const handleEditObservation = async (recordId, originalObs, newText) => {
        if (!newText.trim()) return;
        try {
            const d = await getDoc(doc(db, 'attendance', recordId));
            if (d.exists()) {
                const arr = d.data().observations || [];
                const newArr = arr.map(o => o.date === originalObs.date ? { ...o, text: newText.trim() } : o);
                await updateDoc(doc(db, 'attendance', recordId), { observations: newArr });
            }
        } catch (e) {
            console.error("Error editing observation:", e);
        }
    };

    const handleDeleteObservation = async (recordId, obsToDelete) => {
        try {
            const d = await getDoc(doc(db, 'attendance', recordId));
            if (d.exists()) {
                const arr = d.data().observations || [];
                const newArr = arr.filter(o => o.date !== obsToDelete.date);
                await updateDoc(doc(db, 'attendance', recordId), { observations: newArr });
            }
        } catch (e) {
            console.error("Error deleting observation:", e);
        }
    };

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <IconButton onClick={() => navigate(-1)}><ArrowBack /></IconButton>
                    <Typography variant="h6" fontWeight={800} sx={{ flex: 1, minWidth: 0 }}>
                        Asistencias{selectedDivName ? ` — ${selectedDivName}` : ''}
                    </Typography>
                </Box>

                {!divisionId && (
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                        <Grid container spacing={1.5} alignItems="center">
                            <Grid size={{ xs: 12, sm: 3 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>División</InputLabel>
                                    <Select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)} label="División">
                                        <MenuItem value="">
                                            <em>Todas las divisiones</em>
                                        </MenuItem>
                                        {divisions.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField fullWidth size="small" type="date" label="Desde" value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid size={{ xs: 6, sm: 3 }}>
                                <TextField fullWidth size="small" type="date" label="Hasta" value={dateTo}
                                    onChange={e => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 3 }}>
                                {hasActiveFilter && (
                                    <Button size="small" startIcon={<FilterAltOff />} onClick={resetFilters} color="inherit"
                                        sx={{ textTransform: 'none' }}>
                                        Limpiar filtros
                                    </Button>
                                )}
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {filtered.map(record => {
                    const dateStr = record.date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
                    const typeName = translateType(record.type);
                    const presentCount = (record.presentPlayerIds || []).length;
                    const divName = showAllDivisions ? divsMap[record.divisionId]?.name : null;

                    return (
                        <Accordion key={record.id} sx={{ mb: 1, '&:before': { display: 'none' }, overflow: 'hidden' }}>
                            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 48, px: { xs: 1.5, sm: 2 } }}>
                                <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography fontWeight={700} noWrap sx={{ textTransform: 'capitalize', fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                                            {dateStr}
                                        </Typography>
                                        {divName && <Chip label={divName} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />}
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                                        {typeName} — Presentes: {presentCount}
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ pt: 0, px: { xs: 1.5, sm: 2 } }}>
                                <PlayerStatusGroup title="Presentes" playerIds={record.presentPlayerIds || []} playersMap={playersMap}
                                    color="success.main" icon={<PresentIcon sx={{ color: 'success.main' }} fontSize="small" />} />
                                <PlayerStatusGroup title="Tardanzas" playerIds={record.latePlayerIds || []} playersMap={playersMap}
                                    color="warning.main" icon={<LateIcon sx={{ color: 'warning.main' }} fontSize="small" />} />
                                <PlayerStatusGroup title="Ausentes" playerIds={record.absentPlayerIds || []} playersMap={playersMap}
                                    color="error.main" icon={<AbsentIcon sx={{ color: 'error.main' }} fontSize="small" />} />
                                <AttendanceObservationsManager
                                    record={record}
                                    activeRole={activeRole}
                                    onAdd={handleAddObservation}
onEdit={handleEditObservation}
onDelete={handleDeleteObservation}
                                />
                                {activeRole === 'coach' && (
                                    <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            size="small"
                                            startIcon={<EditIcon />}
                                            variant="outlined"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/coach/attendance?edit=${record.id}`);
                                            }}
                                        >
                                            Editar Asistencia
                                        </Button>
                                    </Box>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    );
                })}

                {filtered.length === 0 && (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No hay registros de asistencia.</Typography>
                    </Box>
                )}
            </Box>
        </Fade>
    );
}

function PlayerStatusGroup({ title, playerIds, playersMap, color, icon }) {
    if (playerIds.length === 0) return null;
    return (
        <Box sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color, mb: 0.25, fontSize: '0.8rem' }}>
                {title} ({playerIds.length})
            </Typography>
            {playerIds.map(id => (
                <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1.5, py: 0.15 }}>
                    {icon}
                    <Typography sx={{ fontSize: '0.82rem' }} noWrap>{playersMap[id]?.name || id}</Typography>
                </Box>
            ))}
            <Divider sx={{ mt: 0.5 }} />
        </Box>
    );
}

export function AttendanceObservationsManager({ record, activeRole, onAdd, onEdit, onDelete }) {
    const [newText, setNewText] = useState('');
    const [editingObs, setEditingObs] = useState(null);
    const [editText, setEditText] = useState('');
    const observations = record.observations || [];
    const legacyNotes = record.notes;

    if (observations.length === 0 && !legacyNotes && activeRole !== 'coach' && activeRole !== 'block_admin' && activeRole !== 'admin' && activeRole !== 'manager') {
        return null;
    }

    const canEdit = activeRole === 'coach' || activeRole === 'block_admin' || activeRole === 'admin' || activeRole === 'manager';

    return (
        <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, backgroundColor: '#e3f2fd', border: '1px solid #90caf9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <NotesIcon sx={{ fontSize: 16, color: '#1565c0' }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1565c0' }}>
                    Observaciones ({observations.length + (legacyNotes ? 1 : 0)})
                </Typography>
            </Box>

            {legacyNotes && (
                <Box sx={{ mb: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Nota heredada</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{legacyNotes}</Typography>
                </Box>
            )}

            {observations.length > 0 && (
                <List dense disablePadding sx={{ mb: 1 }}>
                    {[...observations].sort((a, b) => new Date(b.date) - new Date(a.date)).map((obs, i) => (
                        <ListItem key={i} sx={{ bgcolor: 'background.paper', mb: 0.5, borderRadius: 1, alignItems: 'flex-start', p: 1, display: 'flex', flexDirection: 'column' }}>
                            {editingObs === obs ? (
                                <Box sx={{ width: '100%' }}>
                                    <TextField
                                        fullWidth size="small" multiline rows={2}
                                        value={editText} onChange={e => setEditText(e.target.value)}
                                        sx={{ bgcolor: '#fff', mb: 1 }}
                                    />
                                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                        <Button size="small" color="inherit" onClick={() => setEditingObs(null)}>Cancelar</Button>
                                        <Button size="small" variant="contained" onClick={() => { onEdit(record.id, obs, editText); setEditingObs(null); }}>Guardar</Button>
                                    </Box>
                                </Box>
                            ) : (
                                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>{obs.text}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {obs.authorName} - {new Date(obs.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                        </Typography>
                                    </Box>
                                    {canEdit && (
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <IconButton size="small" onClick={() => { setEditingObs(obs); setEditText(obs.text); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                                            <IconButton size="small" color="error" onClick={() => { if(confirm('¿Eliminar observación?')) onDelete(record.id, obs); }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </ListItem>
                    ))}
                </List>
            )}

            {canEdit && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField
                        size="small" fullWidth placeholder="Nueva observación..."
                        value={newText} onChange={e => setNewText(e.target.value)}
                        sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                    />
                    <Button
                        variant="contained" color="primary" size="small"
                        onClick={() => { onAdd(record.id, newText); setNewText(''); }}
                        disabled={!newText.trim()} sx={{ minWidth: 80 }}
                    >Agregar</Button>
                </Box>
            )}
        </Box>
    );
}
