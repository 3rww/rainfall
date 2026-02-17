import React, { useMemo, useState, useEffect } from 'react';
import { debounce } from 'lodash-es';

import { filterEventByHours } from '../../store/features/rainfallEventsSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

const EventFilter = () => {
  const dispatch = useAppDispatch();
  const maxHours = useAppSelector((state) => state.rainfallEvents?.filters?.maxHours ?? 24);
  const [currentPos, setCurrentPos] = useState(Number(maxHours));

  useEffect(() => {
    setCurrentPos(Number(maxHours));
  }, [maxHours]);

  const debouncedDispatch = useMemo(() => debounce((value) => {
    dispatch(filterEventByHours({ maxHours: value }));
  }, 1000), [dispatch]);

  useEffect(() => () => {
    debouncedDispatch.cancel();
  }, [debouncedDispatch]);

  const handleChange = (event) => {
    const value = Number(event.target.value);
    setCurrentPos(value);
    debouncedDispatch(value);
  };

  return (
    <div>
      <label htmlFor="duration-slider">Filter Events | {currentPos} hours</label>
      <input
        type="range"
        min="1"
        max="24"
        value={currentPos}
        className="form-range"
        id="duration-slider"
        onChange={handleChange}
      />
    </div>
  );
};

export default EventFilter;
