import { useState, useRef, useEffect, useCallback } from 'react';

function useCloseOnClickOrEsc(opts = {}) {
  const node = useRef();
  const handleEscFunction = useCallback(event => {
    if (opts.closeOnEsc === false) {
      return;
    }
    if (event.keyCode === 27) {
      if (opts.closeFormFn) {
        opts.closeFormFn();
      } else {
        setOpen('');
      }
    }
  }, []);

  const [open, setOpen] = useState('');

  const handleClickOutside = useCallback(e => {
    if (node.current.contains(e.target) || opts.closeOnClick === false) {
      // inside click
      return;
    }
    // outside click
    if (opts.closeFormFn) {
      opts.closeFormFn();
    } else {
      setOpen('');
    }
  });

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscFunction, false);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscFunction, false);
    };
  }, []);
  return [node, open, setOpen];
}

export default useCloseOnClickOrEsc;
