import { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Chip, Snackbar, Alert, CircularProgress, Accordion, AccordionSummary,
    AccordionDetails, Avatar, IconButton, List, ListItem, ListItemAvatar, ListItemText,
    Tooltip, Divider
} from '@mui/material';
import { Edit, Delete, Add, ExpandMore, ViewModule, Shield } from '@mui/icons-material';
import { db } from '../../config/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { divisionModelFromMap } from '../../models/DivisionModel';

export default function BlockManagement() {
    const [blocks, setBlocks] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [editBlock, setEditBlock] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        const unsubs = [];
        unsubs.push(onSnapshot(collection(db, 'blocks'), snap => {
            setBlocks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
        }));
        unsubs.push(onSnapshot(collection(db, 'divisions'), snap => {
            setDivisions(snap.docs.map(d => divisionModelFromMap({ ...d.data(), id: d.id })));
        }));
        return () => unsubs.forEach(u => u());
    }, []);

    const handleDelete = async (block) => {
        if (!window.confirm(`¿Estás seguro de que querés eliminar el bloque "${block.name}"?\nEsta acción no se puede deshacer.`)) return;
        try {
            await deleteDoc(doc(db, 'blocks', block.id));
            setSnack({ open: true, msg: 'Bloque eliminado', severity: 'success' });
        } catch (e) {
            setSnack({ open: true, msg: 'Error: ' + e.message, severity: 'error' });
        }
    };

    const divMap = Object.fromEntries(divisions.map(d => [d.id, d]));

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight={800}>Gestión de Bloques</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Crear Bloque</Button>
            </Box>
            {blocks.length === 0 && <Typography color="text.secondary">No hay bloques creados.</Typography>}
            {blocks.map(block => {
                const blockDivisions = (block.divisionIds || []).map(id => divMap[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
                return (
                    <Accordion key={block.id} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMore />} component="div" sx={{ cursor: 'pointer' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', mr: 1 }}>
                                <Avatar sx={{ bgcolor: '#fb8c00', width: 40, height: 40 }}><ViewModule /></Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography fontWeight={700}>{block.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {blockDivisions.length} división(es) asignada(s)
                                    </Typography>
                                </Box>
                                <Box onClick={e => e.stopPropagation()}>
                                    <Tooltip title="Editar"><IconButton size="small" onClick={() => setEditBlock(block)}><Edit fontSize="small" /></IconButton></Tooltip>
                                    <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => handleDelete(block)}><Delete fontSize="small" /></IconButton></Tooltip>
                                </Box>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                            {blockDivisions.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">No hay divisiones asignadas a este bloque.</Typography>
                            ) : (
                                <List dense disablePadding>
                                    {blockDivisions.map((d, i) => (
                                        <Box key={d.id}>
                                            {i > 0 && <Divider />}
                                            <ListItem>
                                                <ListItemAvatar>
                                                    <Avatar sx={{ bgcolor: d.isHidden ? 'grey.500' : 'primary.main', width: 32, height: 32 }}>
                                                        <Shield fontSize="small" />
                                                    </Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={d.name}
                                                    secondary={`Camada ${d.year} | ${d.coachIds.length} Entrenador(es)${d.isHidden ? ' | [OCULTA]' : ''}`}
                                                    primaryTypographyProps={{ fontWeight: 600 }}
                                                    secondaryTypographyProps={{ fontSize: 12 }}
                                                />
                                            </ListItem>
                                        </Box>
                                    ))}
                                </List>
                            )}
                        </AccordionDetails>
                    </Accordion>
                );
            })}
            <BlockDialog open={createOpen} onClose={() => setCreateOpen(false)} divisions={divisions}
                onSuccess={() => { setCreateOpen(false); setSnack({ open: true, msg: 'Bloque creado', severity: 'success' }); }} />
            {editBlock && <BlockDialog open block={editBlock} onClose={() => setEditBlock(null)} divisions={divisions}
                onSuccess={() => { setEditBlock(null); setSnack({ open: true, msg: 'Bloque actualizado', severity: 'success' }); }} />}
            <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
            </Snackbar>
        </Box>
    );
}

function BlockDialog({ open, block = null, onClose, divisions, onSuccess }) {
    const [name, setName] = useState(block?.name || '');
    const [selectedDivIds, setSelectedDivIds] = useState(block?.divisionIds || []);
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            if (block?.id) {
                await updateDoc(doc(db, 'blocks', block.id), { name: name.trim(), divisionIds: selectedDivIds });
            } else {
                const ref = doc(collection(db, 'blocks'));
                await setDoc(ref, { id: ref.id, name: name.trim(), divisionIds: selectedDivIds });
            }
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    const toggle = (id) => setSelectedDivIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    if (!open) return null;
    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{block?.id ? 'Editar Bloque' : 'Crear Bloque'}</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre del Bloque (ej: Infantiles)" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} autoFocus />
                <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Seleccionar Divisiones</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1, maxHeight: 300, overflow: 'auto' }}>
                    {divisions.filter(d => !d.isHidden).sort((a, b) => a.name.localeCompare(b.name)).map(d => (
                        <Chip key={d.id} label={`${d.name} (${d.year})`} color={selectedDivIds.includes(d.id) ? 'primary' : 'default'}
                            variant={selectedDivIds.includes(d.id) ? 'filled' : 'outlined'} onClick={() => toggle(d.id)} sx={{ cursor: 'pointer' }} />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Guardar'}</Button>
            </DialogActions>
        </Dialog>
    );
}
