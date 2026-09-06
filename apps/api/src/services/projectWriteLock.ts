const projectWriteTails = new Map<string, Promise<void>>();

export async function withProjectWriteLock<T>(projectId: string, write: () => Promise<T>): Promise<T> {
  const previous = projectWriteTails.get(projectId) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  projectWriteTails.set(projectId, tail);

  await previous;
  try {
    return await write();
  } finally {
    release();
    if (projectWriteTails.get(projectId) === tail) projectWriteTails.delete(projectId);
  }
}
