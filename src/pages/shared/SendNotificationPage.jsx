import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, getPrimaryRole } from '../../models/UserModel';
import { getAllDivisions, getAllBlocks, createNotification } from '../../services/firestoreService';
import { 
    Box, Typography, Card, CardContent, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, OutlinedInput, 
    Checkbox, ListItemText, Snackbar, Alert, Fade 
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

export default function SendNotificationPage() {
    const { userModel, activeRole } = useAuth();
    const role = activeRole || getPrimaryRole(userModel);
    
    const [divisions, setDivisions] = useState([]);
    const [selectedDivisions, setSelectedDivisions] = useState([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        async function fetchData() {
            const allDivs = await getAllDivisions();
            
            if (role === UserRole.admin) {
                setDivisions(allDivs);
            } else if (role === UserRole.block_admin && userModel?.assignedBlockId) {
                const allBlocks = await getAllBlocks();
                const myBlock = allBlocks.find(b => b.id === userModel.assignedBlockId);
                if (myBlock) {
                    const blockDivs = allDivs.filter(d => (myBlock.divisionIds || []).includes(d.id));
                    setDivisions(blockDivs);
                } else {
                    setDivisions([]);
                }
            }
        }
        fetchData();
    }, [role, userModel]);

    const handleDivisionChange = (event) => {
        const value = event.target.value;
        if (value.includes('ALL')) {
            if (selectedDivisions.length === divisions.length) {
                // If all are already selected and 'ALL' is clicked again, deselect all
                setSelectedDivisions([]);
            } else {
                setSelectedDivisions(divisions.map(d => d.id));
            }
        } else {
            setSelectedDivisions(value);
        }
    };

    const handleSend = async () => {
        if (!title.trim() || !body.trim() || selectedDivisions.length === 0) {
            setSnackbar({ open: true, message: 'Completa todos los campos y selecciona al menos una división', severity: 'warning' });
            return;
        }

        setLoading(true);
        try {
            // Check if all available divisions are selected
            const targets = selectedDivisions.length === divisions.length ? ['ALL'] : selectedDivisions;

            await createNotification({
                title: title.trim(),
                body: body.trim(),
                senderId: userModel.id,
                senderName: userModel.name || userModel.nickname,
                targetDivisionIds: targets,
                createdAt: new Date(),
                // Se mostrará por 7 días
                expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });

            setSnackbar({ open: true, message: 'Notificación enviada correctamente', severity: 'success' });
            setTitle('');
            setBody('');
            setSelectedDivisions([]);
        } catch (e) {
            console.error('Error sending notification:', e);
            setSnackbar({ open: true, message: 'Ocurrió un error al enviar la notificación', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const isAllSelected = divisions.length > 0 && selectedDivisions.length === divisions.length;

    return (
        <Fade in timeout={400}>
            <Box>
                <Typography variant="h4" fontWeight={800} gutterBottom>
                    Enviar Notificación
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Redactá un mensaje para que aparezca en la campana de notificaciones de los miembros durante 7 días.
                </Typography>

                <Card sx={{ maxWidth: 600 }}>
                    <CardContent sx={{ p: 4 }}>
                        <TextField 
                            label="Título" 
                            fullWidth 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            sx={{ mb: 3 }}
                        />
                        <TextField 
                            label="Mensaje" 
                            fullWidth 
                            multiline 
                            rows={4} 
                            value={body} 
                            onChange={(e) => setBody(e.target.value)} 
                            sx={{ mb: 3 }}
                        />

                        <FormControl fullWidth sx={{ mb: 4 }}>
                            <InputLabel id="division-select-label">Divisiones Destino</InputLabel>
                            <Select
                                labelId="division-select-label"
                                multiple
                                value={selectedDivisions}
                                onChange={handleDivisionChange}
                                input={<OutlinedInput label="Divisiones Destino" />}
                                renderValue={(selected) => {
                                    if (selected.length === divisions.length) return 'Todas las divisiones';
                                    const selectedNames = divisions.filter(d => selected.includes(d.id)).map(d => d.name);
                                    return selectedNames.join(', ');
                                }}
                            >
                                <MenuItem value="ALL">
                                    <Checkbox checked={isAllSelected} indeterminate={selectedDivisions.length > 0 && selectedDivisions.length < divisions.length} color="primary" />
                                    <ListItemText primary="Todas las divisiones" primaryTypographyProps={{ fontWeight: 700 }} />
                                </MenuItem>
                                {divisions.map((div) => (
                                    <MenuItem key={div.id} value={div.id}>
                                        <Checkbox checked={selectedDivisions.includes(div.id)} />
                                        <ListItemText primary={div.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button 
                            variant="contained" 
                            size="large" 
                            fullWidth 
                            startIcon={<SendIcon />}
                            onClick={handleSend}
                            disabled={loading}
                        >
                            {loading ? 'Enviando...' : 'Enviar Notificación'}
                        </Button>
                    </CardContent>
                </Card>

                <Snackbar 
                    open={snackbar.open} 
                    autoHideDuration={4000} 
                    onClose={() => setSnackbar({ ...snackbar, open: false })} 
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
                </Snackbar>
            </Box>
        </Fade>
    );
}
