
export const isAbortError = (error: any) => {
  if (!error) return false;
  const name = error.name || '';
  const message = error.message?.toLowerCase() || '';
  
  return name === 'AbortError' || 
         message.includes('aborted') || 
         message.includes('abort');
};
