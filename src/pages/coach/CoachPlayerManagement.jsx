import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { deletePlayer } from '../../services/firestoreService';
import { divisionModelFromMap } from '../../models/DivisionModel';
import { playerModelFromMap } from '../../models/PlayerModel';
import {
    Box, Typography, Card, List, ListItem, ListItemAvatar, ListItemText, Avatar, IconButton,
    Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
    InputLabel, Select, MenuItem, Checkbox, ListItemButton, Snackbar, Alert, Fade, Divider
} from '@mui/material';
import { Edit, Delete, ArrowBack } from '@mui/icons-material';

export default function CoachPlayerManagement() {
    const { divisionId } = useParams();
    const navigate = useNavigate();
    const [division, setDivision] = useState(null);
    const [players, setPlayers] = useState([]);
    const [editPlayer, setEditPlayer] = useState(null);
    const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

    useEffect(() => {
        if (!divisionId) return;
        const unsubs = [];
        unsubs.push(onSnapshot(doc(db, 'divisions', divisionId), snap => {
            if (snap.exists()) setDivision(divisionModelFromMap({ ...snap.data(), id: snap.id }));
        }));
        unsubs.push(onSnapshot(query(collection(db, 'players'), where('divisionId', '==', divisionId)), snap => {
            setPlayers(snap.docs.map(d => playerModelFromMap({ ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name)));
        }));
        return () => unsubs.forEach(u => u());
    }, [divisionId]);

    const handleDelete = async (player) => {
        if (!window.confirm(`¿Estás seguro de que querés eliminar la ficha del jugador "${player.name}"?\nEsta acción no se puede deshacer.`)) return;
        try {
            await deletePlayer(player.id);
            setSnack({ open: true, msg: 'Jugador eliminado', severity: 'success' });
        } catch (e) {
            console.error('Delete player error:', e);
            setSnack({ open: true, msg: 'Error al eliminar: ' + e.message, severity: 'error' });
        }
    };

    return (
        <Fade in timeout={400}>
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <IconButton onClick={() => navigate('/coach')}><ArrowBack /></IconButton>
                    <Typography variant="h5" fontWeight={800}>
                        Jugadores — {division?.name || 'Cargando...'}
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{players.length} jugador(es)</Typography>
                <Card>
                    <List>
                        {players.map((p, i) => (
                            <Box key={p.id}>
                                {i > 0 && <Divider />}
                                <ListItem secondaryAction={
                                    <Box>
                                        <IconButton size="small" onClick={() => setEditPlayer(p)}><Edit fontSize="small" /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDelete(p)}><Delete fontSize="small" /></IconButton>
                                    </Box>
                                }>
                                    <ListItemAvatar><Avatar>{p.name?.[0]?.toUpperCase()}</Avatar></ListItemAvatar>
                                    <ListItemText primary={p.name}
                                        secondary={<>DNI: {p.dni || '-'} {p.phone ? `| Tel: ${p.phone}` : ''}<br />
                                            {p.paidPlayerRightsYears?.includes(new Date().getFullYear()) ? <Chip label="Derecho Pagado" size="small" color="success" sx={{ mt: 0.5, mr: 0.5 }} /> : <Chip label="Derecho NO Pagado" size="small" color="error" sx={{ mt: 0.5, mr: 0.5 }} />}
                                        </>}
                                    />
                                </ListItem>
                            </Box>
                        ))}
                        {players.length === 0 && <ListItem><ListItemText secondary="No hay jugadores en esta división." /></ListItem>}
                    </List>
                </Card>
                {editPlayer && <EditPlayerDialog player={editPlayer} onClose={() => setEditPlayer(null)} onSuccess={() => { setEditPlayer(null); setSnack({ open: true, msg: 'Jugador actualizado', severity: 'success' }); }} />}
                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}><Alert severity={snack.severity}>{snack.msg}</Alert></Snackbar>
            </Box>
        </Fade>
    );
}

function EditPlayerDialog({ player, onClose, onSuccess }) {
    const [name, setName] = useState(player.name);
    const [dni, setDni] = useState(player.dni || '');
    const [phone, setPhone] = useState(player.phone || '');
    const [obraSocial, setObraSocial] = useState(player.obraSocial || '');
    const [emergencyContactName, setEmergencyContactName] = useState(player.emergencyContactName || '');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState(player.emergencyContactPhone || '');
    const [birthDate, setBirthDate] = useState(player.birthDate ? player.birthDate.toISOString().split('T')[0] : '');
    const [clubFeePayments, setClubFeePayments] = useState({ ...player.clubFeePayments });
    const [paidYears, setPaidYears] = useState([...player.paidPlayerRightsYears]);
    const [notes, setNotes] = useState([...(player.notes || [])]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(false);

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
            await updateDoc(doc(db, 'players', player.id), { name: name.trim(), dni: dni.trim(), phone: phone.trim(), obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), birthDate: birthDate ? new Date(birthDate).toISOString() : player.birthDate?.toISOString(), clubFeePayments, paidPlayerRightsYears: paidYears, notes });
            if (player.userId) {
                try { await updateDoc(doc(db, 'users', player.userId), { name: name.trim(), dni: dni.trim(), phone: phone.trim(), obraSocial: obraSocial.trim(), emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim() }); } catch (e) { console.log('Linked user update error:', e); }
            }
            onSuccess();
        } catch (e) { alert('Error: ' + e.message); } finally { setLoading(false); }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Editar Jugador</DialogTitle>
            <DialogContent>
                <TextField fullWidth label="Nombre, Apellido (apodo)" value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1 }} />
                <TextField fullWidth label="DNI" value={dni} onChange={e => setDni(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Obra Social (Opcional)" value={obraSocial} onChange={e => setObraSocial(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Nombre) (Opcional)" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Contacto Emergencia (Teléfono) (Opcional)" value={emergencyContactPhone} onChange={e => setEmergencyContactPhone(e.target.value)} sx={{ mt: 2 }} />
                <TextField fullWidth label="Fecha de Nacimiento" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} sx={{ mt: 2 }} InputLabelProps={{ shrink: true }} />
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Cuotas del Club ({currentYear})</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {months.map((m, i) => {
                        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                        return <Chip key={key} label={m} size="small" color={clubFeePayments[key] ? 'success' : 'default'} variant={clubFeePayments[key] ? 'filled' : 'outlined'} onClick={() => setClubFeePayments(prev => ({ ...prev, [key]: !prev[key] }))} />;
                    })}
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>Derechos de Jugador</Typography>
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
