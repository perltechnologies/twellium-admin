import { useEffect } from 'react';

export const useClearPageFilters = (storageKey) => {
    useEffect(() => () => {
        localStorage.removeItem(storageKey);
    }, [storageKey]);
};
