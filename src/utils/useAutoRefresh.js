import React, { useEffect, useRef } from 'react';
import { useRefresh } from '../context/RefreshContext';

export const useAutoRefresh = (callback, dependencies = []) => {
    const { enabled, interval } = useRefresh();
    const savedCallback = useRef();

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return;

        const tick = () => savedCallback.current?.();
        const id = setInterval(tick, interval);
        return () => clearInterval(id);
    }, [enabled, interval, ...dependencies]);
};
