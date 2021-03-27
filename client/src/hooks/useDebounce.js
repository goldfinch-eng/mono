import { useMemo } from 'react';
import _ from 'lodash';

function useDebounce(fn, ms = 500) {
  const debounced = useMemo(() => _.debounce(fn, ms), [fn, ms]);
  return debounced;
}

export default useDebounce;
