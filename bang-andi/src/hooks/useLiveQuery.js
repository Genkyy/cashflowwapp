import { useState, useEffect, useRef } from 'react';
import { liveQuery } from 'dexie';

const listeners = new Set();

/**
 * Notify all live queries that database state has changed
 */
export function notifyDatabaseChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error running change listener:', err);
    }
  });
}

/**
 * Subscribe to manual database change notifications
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeDatabaseChange(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * React hook to observe Dexie queries reactively
 * @param {Function} querier - Function returning a promise or value from Dexie
 * @param {Array} deps - Dependency array for re-subscribing
 * @param {any} [defaultResult] - Initial value before query resolves
 * @returns {any} Result of the query
 */
export function useLiveQuery(querier, deps = [], defaultResult = undefined) {
  const [value, setValue] = useState(defaultResult);
  const [version, setVersion] = useState(0);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  // Listen for manual trigger broadcasts
  useEffect(() => {
    return subscribeDatabaseChange(() => {
      setVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    let subscription = null;

    try {
      const observable = liveQuery(() => querierRef.current());
      subscription = observable.subscribe({
        next: (val) => {
          if (isMounted) {
            setValue(val);
          }
        },
        error: (err) => {
          console.warn('Dexie liveQuery note, falling back to direct promise:', err);
          Promise.resolve(querierRef.current())
            .then((val) => {
              if (isMounted) setValue(val);
            })
            .catch((e) => console.error('useLiveQuery direct query error:', e));
        },
      });
    } catch {
      Promise.resolve(querierRef.current())
        .then((val) => {
          if (isMounted) setValue(val);
        })
        .catch((e) => console.error('useLiveQuery execution error:', e));
    }

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return value;
}

export default useLiveQuery;
