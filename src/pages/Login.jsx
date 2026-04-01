import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getPrimaryRole, RoleDashboardRoutes, RoleLabels } from '../models/UserModel';
import {
    Box, Card, CardContent, TextField, Button, Typography,
    InputAdornment, IconButton, Alert, CircularProgress, Fade,
    Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Divider, Link
} from '@mui/material';
import {
    Visibility, VisibilityOff, Person as PersonIcon, Lock as LockIcon,
    Login as LoginIcon, SwapHoriz as SwapIcon, Email as EmailIcon
} from '@mui/icons-material';

const roleColors = { admin: '#e53935', coach: '#43a047', player: '#8e24aa', parent: '#00897b', manager: '#1e88e5', block_admin: '#fb8c00' };

export default function Login() {
    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rolePickerUser, setRolePickerUser] = useState(null);
    const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState('');
    const [resetError, setResetError] = useState('');
    const { signIn, switchRole } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!emailOrUsername.trim() || !password.trim()) {
            setError('Por favor, completá todos los campos.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const user = await signIn(emailOrUsername.trim(), password);
            if (user) {
                if (user.roles.length > 1) {
                    // Show role picker
                    setRolePickerUser(user);
                    setLoading(false);
                } else {
                    const role = getPrimaryRole(user);
                    switchRole(role);
                    navigate(RoleDashboardRoutes[role] || '/', { replace: true });
                }
            } else {
                setError('No se encontraron datos del usuario.');
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError('Correo/usuario o contraseña incorrectos.');
            } else if (err.code === 'auth/user-not-found') {
                setError('Usuario no encontrado.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Demasiados intentos. Intentá más tarde.');
            } else if (err.message === 'Usuario no encontrado.') {
                setError('Usuario no encontrado.');
            } else {
                setError('Error al iniciar sesión. Intentá nuevamente.');
            }
        } finally {
            if (!rolePickerUser) setLoading(false);
        }
    };

    const handleRoleSelect = (role) => {
        switchRole(role);
        const route = RoleDashboardRoutes[role] || '/';
        navigate(route, { replace: true });
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 30%, #43A047 60%, #66BB6A 100%)',
                p: 2,
            }}
        >
            <Fade in timeout={600}>
                <Card sx={{
                    width: '100%', maxWidth: 440, p: 2,
                    backdropFilter: 'blur(20px)',
                    background: 'rgba(255,255,255,0.95)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}>
                    <CardContent sx={{ p: 3 }}>
                        {/* Logo / Title */}
                        <Box sx={{ textAlign: 'center', mb: 4 }}>
                            <Box sx={{ mx: 'auto', mb: 2, width: 100, height: 100 }}>
                                <img src="/logo_uni.png" alt="Universitario RC" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', fontFamily: '"Montserrat", sans-serif' }}>
                                Universitario RC
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Ingresá con tu cuenta para continuar
                            </Typography>
                        </Box>

                        {/* Error Alert */}
                        {error && (
                            <Fade in>
                                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                                    {error}
                                </Alert>
                            </Fade>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Email o nombre de usuario"
                                value={emailOrUsername}
                                onChange={(e) => setEmailOrUsername(e.target.value)}
                                margin="normal"
                                autoComplete="username"
                                autoFocus
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start"><PersonIcon color="action" /></InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                fullWidth
                                label="Contraseña"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                margin="normal"
                                autoComplete="current-password"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start"><LockIcon color="action" /></InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                                sx={{ mt: 3, mb: 1, py: 1.5 }}
                            >
                                {loading ? 'Ingresando...' : 'Ingresar'}
                            </Button>

                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                <Link
                                    component="button"
                                    type="button"
                                    variant="body2"
                                    onClick={() => {
                                        setResetError('');
                                        setResetSuccess('');
                                        setResetEmail('');
                                        setForgotPasswordOpen(true);
                                    }}
                                    sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </Box>
                        </form>
                    </CardContent>
                </Card>
            </Fade>

            {/* Forgot Password Dialog */}
            <Dialog open={forgotPasswordOpen} onClose={() => !resetLoading && setForgotPasswordOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                    <EmailIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h6" fontWeight={700}>Recuperar Contraseña</Typography>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Ingresá tu correo electrónico y te enviaremos un enlace para que puedas restablecer tu contraseña.
                    </Typography>

                    {resetError && <Alert severity="error" sx={{ mb: 2 }}>{resetError}</Alert>}
                    {resetSuccess && <Alert severity="success" sx={{ mb: 2 }}>{resetSuccess}</Alert>}

                    <TextField
                        fullWidth
                        label="Correo Electrónico"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={resetLoading || !!resetSuccess}
                        autoFocus
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setForgotPasswordOpen(false)} disabled={resetLoading}>
                        Cancelar
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={async () => {
                            if (!resetEmail.trim()) return setResetError('Por favor, ingresá tu email.');
                            setResetLoading(true);
                            setResetError('');
                            try {
                                await sendPasswordResetEmail(auth, resetEmail.trim());
                                setResetSuccess('Enlace enviado. Por favor, revisá tu casilla de correo (y la carpeta de Spam).');
                                setTimeout(() => setForgotPasswordOpen(false), 5000);
                            } catch (err) {
                                console.error('Reset error:', err);
                                if (err.code === 'auth/user-not-found') setResetError('No existe un usuario con ese correo.');
                                else setResetError('Error al enviar el correo. Verificá los datos.');
                            } finally {
                                setResetLoading(false);
                            }
                        }} 
                        disabled={resetLoading || !!resetSuccess}
                    >
                        {resetLoading ? 'Enviando...' : 'Enviar Enlace'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Role Picker Dialog */}
            <Dialog open={!!rolePickerUser} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
                <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mx: 'auto', mb: 1.5, fontSize: 24 }}>
                        {rolePickerUser?.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Typography variant="h6" fontWeight={700}>¡Hola, {rolePickerUser?.name?.split(' ')[0]}!</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Tenés {rolePickerUser?.roles?.length} roles. Seleccioná con cuál querés ingresar:
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                        {rolePickerUser?.roles?.map(role => (
                            <Button
                                key={role}
                                variant="outlined"
                                size="large"
                                onClick={() => handleRoleSelect(role)}
                                sx={{
                                    justifyContent: 'flex-start', textTransform: 'none', py: 1.5, px: 2,
                                    borderColor: roleColors[role] || '#757575',
                                    color: roleColors[role] || '#757575',
                                    '&:hover': {
                                        bgcolor: (roleColors[role] || '#757575') + '15',
                                        borderColor: roleColors[role] || '#757575',
                                    }
                                }}
                                startIcon={
                                    <Avatar sx={{ bgcolor: roleColors[role] || '#757575', width: 32, height: 32, fontSize: 14 }}>
                                        {(RoleLabels[role] || role)[0]?.toUpperCase()}
                                    </Avatar>
                                }
                            >
                                <Box sx={{ textAlign: 'left' }}>
                                    <Typography fontWeight={600}>{RoleLabels[role] || role}</Typography>
                                </Box>
                            </Button>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
}
