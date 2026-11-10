import React, { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { buildRainfallShareUrl } from '../../store/urlShareState';

export default function ShareQueryButton({ contextType, query }) {
  const [prepared, setPrepared] = useState(null);
  const [feedback, setFeedback] = useState(null);
  useEffect(() => {
    let current = true;
    setPrepared(null);
    setFeedback(null);
    buildRainfallShareUrl(contextType, query).then(
      url => { if (current) setPrepared({ query, contextType, url }); },
      () => { if (current) setPrepared({ query, contextType, error: 'Could not prepare this query link.' }); }
    );
    return () => { current = false; };
  }, [contextType, query]);
  const ready = prepared?.query === query && prepared?.contextType === contextType ? prepared : null;
  const notice = feedback?.prepared === ready ? feedback : null;
  const copy = event => {
    event.stopPropagation();
    if (!ready?.url) return;
    // Invoke the clipboard during the click's user activation; compression has
    // already finished. Feedback belongs to this prepared snapshot only.
    try {
      Promise.resolve(navigator.clipboard.writeText(ready.url)).then(
        () => setFeedback({ prepared: ready, copied: true }),
        () => setFeedback({ prepared: ready, copied: false })
      );
    } catch {
      setFeedback({ prepared: ready, copied: false });
    }
  };
  return (
    <div onClick={event => event.stopPropagation()}>
      <Button variant="outline-primary" size="sm" disabled={!ready?.url} onClick={copy}>
        Share
      </Button>
      <span className="small ms-2" role="status">
        {!ready ? 'Preparing link…' : ready.error || (notice?.copied ? 'Link copied.' : '')}
      </span>
      {notice?.copied === false && (
        <Form.Group className="mt-2 small">
          <Form.Label>Could not copy the link. Select and copy this URL:</Form.Label>
          <Form.Control aria-label="Share query URL" size="sm" readOnly value={ready.url}
            onFocus={event => event.target.select()} onClick={event => event.currentTarget.select()} />
        </Form.Group>
      )}
    </div>
  );
}
