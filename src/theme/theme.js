import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1B5E20',
            light: '#4C8C4A',
            dark: '#003300',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#81C784',
            light: '#B2FAB4',
            dark: '#519657',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#F5F5F5',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#212121',
            secondary: '#757575',
        },
        error: {
            main: '#E57373',
        },
        success: {
            main: '#66BB6A',
        },
        warning: {
            main: '#FFA726',
        },
        info: {
            main: '#42A5F5',
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontFamily: '"Montserrat", "Roboto", sans-serif',
            fontWeight: 700,
            fontSize: '2rem',
        },
        h2: {
            fontFamily: '"Montserrat", "Roboto", sans-serif',
            fontWeight: 600,
            fontSize: '1.75rem',
        },
        h3: {
            fontFamily: '"Montserrat", "Roboto", sans-serif',
            fontWeight: 600,
            fontSize: '1.5rem',
        },
        h4: {
            fontFamily: '"Montserrat", "Roboto", sans-serif',
            fontWeight: 600,
            fontSize: '1.25rem',
        },
        h5: {
            fontWeight: 600,
            fontSize: '1.1rem',
        },
        h6: {
            fontWeight: 600,
            fontSize: '1rem',
        },
        button: {
            fontFamily: '"Montserrat", "Roboto", sans-serif',
            fontWeight: 700,
            textTransform: 'none',
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    padding: '10px 24px',
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(27, 94, 32, 0.3)',
                    },
                },
                contained: {
                    background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #003300 0%, #1B5E20 100%)',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 12,
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 16,
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    borderRight: 'none',
                    boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    fontWeight: 500,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                },
            },
        },
    },
});

export default theme;
