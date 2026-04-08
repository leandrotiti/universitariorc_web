import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import DivisionManagement from './pages/admin/DivisionManagement';
import ReportsPage from './pages/admin/ReportsPage';
import BlockManagement from './pages/admin/BlockManagement';
import CoachDashboard from './pages/coach/CoachDashboard';
import AttendancePage from './pages/coach/AttendancePage';
import AttendanceHistory from './pages/coach/AttendanceHistory';
import CoachPlayerManagement from './pages/coach/CoachPlayerManagement';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import PlayerDashboard from './pages/player/PlayerDashboard';
import ParentDashboard from './pages/parent/ParentDashboard';
import BlockAdminDashboard from './pages/block_admin/BlockAdminDashboard';
import ProfilePage from './pages/Profile';
import SendNotificationPage from './pages/shared/SendNotificationPage';
import { UserRole } from './models/UserModel';
import { getPrimaryRole, RoleDashboardRoutes } from './models/UserModel';
import { Box, CircularProgress } from '@mui/material';

function RoleRedirect() {
  const { userModel, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!userModel) return <Navigate to="/login" replace />;

  const role = getPrimaryRole(userModel);
  const route = RoleDashboardRoutes[role] || '/login';
  return <Navigate to={route} replace />;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Dashboard Layout */}
            <Route element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              {/* Admin */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={[UserRole.admin]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute allowedRoles={[UserRole.admin]}>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/divisions" element={
                <ProtectedRoute allowedRoles={[UserRole.admin]}>
                  <DivisionManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/blocks" element={
                <ProtectedRoute allowedRoles={[UserRole.admin]}>
                  <BlockManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={[UserRole.admin]}>
                  <ReportsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/notifications" element={
                <ProtectedRoute allowedRoles={[UserRole.admin]}>
                  <SendNotificationPage />
                </ProtectedRoute>
              } />

              {/* Coach */}
              <Route path="/coach" element={
                <ProtectedRoute allowedRoles={[UserRole.coach]}>
                  <CoachDashboard />
                </ProtectedRoute>
              } />
              <Route path="/coach/attendance" element={
                <ProtectedRoute allowedRoles={[UserRole.coach, UserRole.block_admin]}>
                  <AttendancePage />
                </ProtectedRoute>
              } />
              <Route path="/coach/history" element={
                <ProtectedRoute allowedRoles={[UserRole.coach, UserRole.block_admin]}>
                  <AttendanceHistory />
                </ProtectedRoute>
              } />
              <Route path="/coach/players/:divisionId" element={
                <ProtectedRoute allowedRoles={[UserRole.coach]}>
                  <CoachPlayerManagement />
                </ProtectedRoute>
              } />
              <Route path="/coach/attendance-history/:divisionId" element={
                <ProtectedRoute allowedRoles={[UserRole.coach, UserRole.block_admin]}>
                  <AttendanceHistory />
                </ProtectedRoute>
              } />
              <Route path="/coach/players" element={
                <ProtectedRoute allowedRoles={[UserRole.coach]}>
                  <CoachDashboard />
                </ProtectedRoute>
              } />

              {/* Manager */}
              <Route path="/manager" element={
                <ProtectedRoute allowedRoles={[UserRole.manager]}>
                  <ManagerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/manager/history" element={
                <ProtectedRoute allowedRoles={[UserRole.manager]}>
                  <AttendanceHistory />
                </ProtectedRoute>
              } />
              <Route path="/manager/attendance-history/:divisionId" element={
                <ProtectedRoute allowedRoles={[UserRole.manager]}>
                  <AttendanceHistory />
                </ProtectedRoute>
              } />
              <Route path="/manager/*" element={
                <ProtectedRoute allowedRoles={[UserRole.manager]}>
                  <ManagerDashboard />
                </ProtectedRoute>
              } />

              {/* Block Admin */}
              <Route path="/block-admin" element={
                <ProtectedRoute allowedRoles={[UserRole.block_admin]}>
                  <BlockAdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/block-admin/users" element={
                <ProtectedRoute allowedRoles={[UserRole.block_admin]}>
                  <BlockAdminDashboard page="users" />
                </ProtectedRoute>
              } />
              <Route path="/block-admin/divisions" element={
                <ProtectedRoute allowedRoles={[UserRole.block_admin]}>
                  <BlockAdminDashboard page="divisions" />
                </ProtectedRoute>
              } />
              <Route path="/block-admin/reports" element={
                <ProtectedRoute allowedRoles={[UserRole.block_admin]}>
                  <BlockAdminDashboard page="reports" />
                </ProtectedRoute>
              } />
              <Route path="/block-admin/notifications" element={
                <ProtectedRoute allowedRoles={[UserRole.block_admin]}>
                  <SendNotificationPage />
                </ProtectedRoute>
              } />

              {/* Player */}
              <Route path="/player" element={
                <ProtectedRoute allowedRoles={[UserRole.player]}>
                  <PlayerDashboard />
                </ProtectedRoute>
              } />

              {/* Parent */}
              <Route path="/parent" element={
                <ProtectedRoute allowedRoles={[UserRole.parent]}>
                  <ParentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/parent/*" element={
                <ProtectedRoute allowedRoles={[UserRole.parent]}>
                  <ParentDashboard />
                </ProtectedRoute>
              } />

              {/* Profile */}
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<RoleRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
