
export interface PinterestPinData {
  title: string;
  description: string;
  boardId: string;
  link?: string;
  imageData: string; // Base64 without prefix
  publishAt?: string; // ISO 8601 string for scheduling
}

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a 503, it might be a temporary overload, so we retry
      if (response.status === 503 && i < retries - 1) {
        console.warn(`Server returned 503, retrying (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      
      return response;
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || '';
      const isNetworkError = msg.includes('failed to fetch') || 
                             err.name === 'TypeError' || 
                             msg.includes('aborted');
      
      if (isNetworkError && i < retries - 1) {
        console.warn(`Fetch failed, retrying (${i + 1}/${retries})...`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
        continue;
      }
      throw err;
    }
  }
  throw new Error('Fetch failed after multiple retries');
};

export const getPinterestConfig = async (idToken: string) => {
  try {
    const response = await fetch('/api/pinterest/config', {
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });
    if (!response.ok) return { useSandbox: false };
    return await response.json();
  } catch (e) {
    return { useSandbox: false };
  }
};

export const createPinterestPin = async (data: PinterestPinData, token: string, idToken: string) => {
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

  const jsonPayload = JSON.stringify({
    endpoint: '/pins',
    method: 'POST',
    data: payload,
    token: token
  });

  console.log(`[Pinterest Service] Payload size: ${Math.round(jsonPayload.length / 1024)} KB`);

  const response = await fetchWithRetry('/api/pinterest/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: jsonPayload,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to create Pinterest pin';
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (e) {
      console.error('Failed to read error response body');
    }

    try {
      const errorData = JSON.parse(responseText);
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
      // If not JSON, use the raw text if available
      if (responseText) {
        if (responseText.includes('<title>403 Forbidden</title>')) {
          errorMessage = "Access Forbidden (403). This usually means your Pinterest account or app doesn't have permission to perform this action, or the request was blocked by a security filter.";
        } else {
          errorMessage = responseText;
        }
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

export const fetchPinterestBoards = async (token: string, idToken: string) => {
  const response = await fetchWithRetry('/api/pinterest/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      endpoint: '/boards',
      method: 'GET',
      token: token
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to fetch Pinterest boards';
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (e) {
      console.error('Failed to read error response body');
    }

    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      if (responseText) {
        errorMessage = responseText;
      }
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
