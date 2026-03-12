
export interface PinterestPinData {
  title: string;
  description: string;
  boardId: string;
  link?: string;
  imageData: string; // Base64 without prefix
  publishAt?: string; // ISO 8601 string for scheduling
}

export const createPinterestPin = async (data: PinterestPinData, token: string) => {
  const payload: any = {
    title: data.title,
    description: data.description,
    board_id: data.boardId,
    link: data.link || 'https://pingenius.ai',
    media_source: {
      source_type: 'image_base64',
      content_type: 'image/jpeg',
      data: data.imageData.replace(/[^a-zA-Z0-9+/=]/g, ''),
    },
  };

  if (data.publishAt) {
    payload.publish_at = data.publishAt;
  }

  const response = await fetch('/api/pinterest/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: '/pins',
      method: 'POST',
      data: payload,
      token: token
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to create Pinterest pin';
    try {
      const errorData = await response.json();
      // The proxy returns { message, details }
      errorMessage = errorData.message || errorMessage;
      
      // If there are specific validation errors in the details, append them
      const details = errorData.details;
      if (details?.errors && Array.isArray(details.errors)) {
        const subErrors = details.errors.map((e: any) => e.message).join(', ');
        if (subErrors) errorMessage += `: ${subErrors}`;
      } else if (details?.message) {
        errorMessage = details.message;
      }
    } catch (e) {
      // If not JSON, try text
      try {
        const text = await response.text();
        console.error('Raw error response:', text);
        errorMessage = text || errorMessage;
      } catch (e2) {
        console.error('Failed to read error response as text');
      }
    }
    throw new Error(errorMessage);
  }

  try {
    return await response.json();
  } catch (e) {
    throw new Error('Invalid response from server');
  }
};

export const fetchPinterestBoards = async (token: string) => {
  const response = await fetch('/api/pinterest/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: '/boards',
      method: 'GET',
      token: token
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch Pinterest boards';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      try {
        const text = await response.text();
        errorMessage = text || errorMessage;
      } catch (e2) {}
    }
    throw new Error(errorMessage);
  }

  try {
    const data = await response.json();
    return data.items || [];
  } catch (e) {
    throw new Error('Invalid response from server');
  }
};
