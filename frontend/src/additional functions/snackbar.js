import { useState } from 'react';

const useSnackbar = () => {
  const [state, setState] = useState({
    open: false,
    message: '',
    vertical: 'bottom',
    horizontal: 'left',
  });

  const showSnackbar = (message, duration = 5000) => {
    setState(prev => ({
      ...prev,
      open: true,
      message,
    }));

    setTimeout(() => {
      setState(prev => ({
        ...prev,
        open: false
      }));
    }, duration);
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setState(prev => ({
      ...prev,
      open: false
    }));
  };

  return { state, showSnackbar, handleClose };
}

export default useSnackbar;