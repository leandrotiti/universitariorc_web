import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPrimaryRole, RoleLabels, RoleDashboardRoutes, UserRole } from '../../models/UserModel';
import {
    AppBar, Toolbar, Typography, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
    Box, IconButton, Avatar, Menu, MenuItem, Divider, Chip, useMediaQuery, useTheme,
    Fade, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import {
    Menu as MenuIcon, Dashboard as DashboardIcon, People as PeopleIcon,
    Sports as SportsIcon, EventNote as EventNoteIcon, Assessment as AssessmentIcon,
    Person as PersonIcon, Logout as LogoutIcon, ChevronLeft as ChevronLeftIcon,
    Groups as GroupsIcon, FamilyRestroom as FamilyIcon, AdminPanelSettings as AdminIcon,
    SportsScore as CoachIcon, SwapHoriz as SwapIcon,
} from '@mui/icons-material';

const DRAWER_WIDTH = 280;

const roleMenuItems = {
    [UserRole.admin]: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/admin' },
        { label: 'Usuarios', icon: <PeopleIcon />, path: '/admin/users' },
        { label: 'Divisiones', icon: <GroupsIcon />, path: '/admin/divisions' },
        { label: 'Bloques', icon: <SportsIcon />, path: '/admin/blocks' },
        { label: 'Reportes', icon: <AssessmentIcon />, path: '/admin/reports' },
    ],
    [UserRole.coach]: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/coach' },
        { label: 'Asistencia', icon: <EventNoteIcon />, path: '/coach/attendance' },
        { label: 'Historial', icon: <AssessmentIcon />, path: '/coach/history' },
        { label: 'Jugadores', icon: <PeopleIcon />, path: '/coach/players' },
    ],
    [UserRole.manager]: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/manager' },
        { label: 'Jugadores', icon: <PeopleIcon />, path: '/manager/players' },
        { label: 'Historial', icon: <EventNoteIcon />, path: '/manager/history' },
    ],
    [UserRole.block_admin]: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/block-admin' },
        { label: 'Divisiones', icon: <GroupsIcon />, path: '/block-admin/divisions' },
        { label: 'Usuarios', icon: <PeopleIcon />, path: '/block-admin/users' },
        { label: 'Reportes', icon: <AssessmentIcon />, path: '/block-admin/reports' },
    ],
    [UserRole.player]: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/player' },
    ],
    [UserRole.parent]: [
        { label: 'Dashboard', icon: <DashboardIcon />, path: '/parent' },
        { label: 'Asistencia Hijos', icon: <FamilyIcon />, path: '/parent/attendance' },
    ],
};

const roleIcons = {
    [UserRole.admin]: <AdminIcon />,
    [UserRole.coach]: <CoachIcon />,
    [UserRole.manager]: <PeopleIcon />,
    [UserRole.block_admin]: <SportsIcon />,
    [UserRole.player]: <PersonIcon />,
    [UserRole.parent]: <FamilyIcon />,
};

export default function DashboardLayout() {
    const { userModel, signOut, activeRole, switchRole } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

    // Use activeRole from context (supports multi-role switching)
    const currentRole = activeRole || getPrimaryRole(userModel);
    const menuItems = roleMenuItems[currentRole] || [];
    const hasMultipleRoles = userModel?.roles?.length > 1;

    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
    const handleProfileMenu = (e) => setAnchorEl(e.currentTarget);
    const handleCloseMenu = () => setAnchorEl(null);

    const handleLogoutClick = () => {
        handleCloseMenu();
        setLogoutDialogOpen(true);
    };

    const handleConfirmLogout = async () => {
        setLogoutDialogOpen(false);
        await signOut();
        navigate('/login');
    };

    const handleSwitchRole = (role) => {
        setLogoutDialogOpen(false);
        switchRole(role);
        const route = RoleDashboardRoutes[role] || '/';
        navigate(route);
    };

    const handleProfile = () => {
        handleCloseMenu();
        navigate('/profile');
    };

    const drawerContent = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{
                p: 3, display: 'flex', alignItems: 'center', gap: 2,
                background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
                color: 'white',
            }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48, fontSize: '1.2rem', fontWeight: 700 }}>
                    {userModel?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>{userModel?.name}</Typography>
                    <Chip
                        label={RoleLabels[currentRole]}
                        size="small"
                        sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.7rem', height: 22 }}
                    />
                </Box>
                {isMobile && (
                    <IconButton onClick={handleDrawerToggle} sx={{ color: 'white' }}>
                        <ChevronLeftIcon />
                    </IconButton>
                )}
            </Box>

            {/* Nav Items */}
            <List sx={{ flex: 1, px: 1.5, py: 2 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItemButton
                            key={item.path}
                            onClick={() => {
                                navigate(item.path);
                                if (isMobile) setMobileOpen(false);
                            }}
                            sx={{
                                borderRadius: 2, mb: 0.5, py: 1.2,
                                bgcolor: isActive ? 'primary.main' : 'transparent',
                                color: isActive ? 'white' : 'text.primary',
                                '&:hover': {
                                    bgcolor: isActive ? 'primary.dark' : 'action.hover',
                                },
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <ListItemIcon sx={{ color: isActive ? 'white' : 'text.secondary', minWidth: 40 }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, fontSize: '0.95rem' }} />
                        </ListItemButton>
                    );
                })}
            </List>

            {/* Footer */}
            <Divider />
            <List sx={{ px: 1.5, py: 1 }}>
                <ListItemButton onClick={handleProfile} sx={{ borderRadius: 2 }}>
                    <ListItemIcon><PersonIcon /></ListItemIcon>
                    <ListItemText primary="Mi Perfil" />
                </ListItemButton>
                <ListItemButton onClick={handleLogoutClick} sx={{ borderRadius: 2, color: 'error.main' }}>
                    <ListItemIcon><LogoutIcon color="error" /></ListItemIcon>
                    <ListItemText primary="Cerrar Sesión" />
                </ListItemButton>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* Sidebar */}
            <Drawer
                variant={isMobile ? 'temporary' : 'permanent'}
                open={isMobile ? mobileOpen : true}
                onClose={handleDrawerToggle}
                sx={{
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Main Content */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* AppBar */}
                <AppBar position="sticky" sx={{ bgcolor: 'white', color: 'text.primary' }} elevation={0}>
                    <Toolbar>
                        {isMobile && (
                            <IconButton edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
                                <MenuIcon />
                            </IconButton>
                        )}
                        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
                            Universitario RC
                        </Typography>
                        <Tooltip title="Mi cuenta">
                            <IconButton onClick={handleProfileMenu}>
                                <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: '0.9rem' }}>
                                    {userModel?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </Avatar>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleCloseMenu}
                            TransitionComponent={Fade}
                            PaperProps={{ sx: { mt: 1, minWidth: 180 } }}
                        >
                            <MenuItem disabled>
                                <Typography variant="body2" color="text.secondary">{userModel?.email}</Typography>
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleProfile}>
                                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                                Mi Perfil
                            </MenuItem>
                            <MenuItem onClick={handleLogoutClick}>
                                <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                                <Typography color="error">Cerrar Sesión</Typography>
                            </MenuItem>
                        </Menu>
                    </Toolbar>
                </AppBar>

                {/* Page Content */}
                <Box component="main" sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 3 }, position: 'relative', overflow: 'auto' }}>
                    {/* Watermark Logo */}
                    <Box sx={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0,
                        opacity: 0.06, width: '60%', maxWidth: 500,
                    }}>
                        <img src="/logo_uni.png" alt="" style={{ width: '100%', height: 'auto' }} />
                    </Box>
                    <Fade in timeout={300}>
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                            <Outlet />
                        </Box>
                    </Fade>
                </Box>
            </Box>

            {/* Logout / Role Switch Dialog */}
            <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>¿Qué deseas hacer?</DialogTitle>
                <DialogContent>
                    {hasMultipleRoles && (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                Tenés {userModel.roles.length} roles asignados. Podés cambiar de rol sin cerrar sesión:
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {userModel.roles.filter(r => r !== currentRole).map(role => (
                                    <Button
                                        key={role}
                                        variant="outlined"
                                        startIcon={<SwapIcon />}
                                        onClick={() => handleSwitchRole(role)}
                                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                                    >
                                        Cambiar a {RoleLabels[role] || role}
                                    </Button>
                                ))}
                            </Box>
                            <Divider sx={{ my: 2 }} />
                        </Box>
                    )}
                    <Typography variant="body2" color="text.secondary">
                        ¿Estás seguro de que querés cerrar sesión?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogoutDialogOpen(false)} color="inherit">Cancelar</Button>
                    <Button onClick={handleConfirmLogout} color="error" variant="contained">Cerrar Sesión</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
