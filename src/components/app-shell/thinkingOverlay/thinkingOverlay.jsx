import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons';
import { useAppSelector } from '../../../store/hooks';

import './thinkingOverlay.css';

const ThinkingOverlay = () => {
  const isAppThinking = useAppSelector((state) => state.progress.isThinking > 0);
  const message = useAppSelector((state) => {
    const messages = state.progress.messages;
    return messages[messages.length - 1];
  });

  if (!isAppThinking) {
    return null;
  }

  return (
    <div className="thinking-overlay">
      <div className="d-flex thinking-content">
        <span className="fa-layers fa-fw">
          <FontAwesomeIcon icon={faSpinner} pulse size="8x" />
          <FontAwesomeIcon icon={faCloudRain} size="4x" transform="right-8" />
        </span>
      </div>
      <p className="debug-messages">{message}</p>
    </div>
  );
};

export default ThinkingOverlay;
