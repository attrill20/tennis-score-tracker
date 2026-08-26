const NEON_API_BASE = 'https://console.neon.tech/api/v2';

async function neonApiRequest(path: string, init?: RequestInit) {
  const res = await fetch(`${NEON_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Neon API ${path} failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function waitForOperations(projectId: string, operationIds: string[], timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  const pending = new Set(operationIds);

  while (pending.size > 0) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for Neon operation(s): ${[...pending].join(', ')}`);
    }

    for (const id of pending) {
      const { operation } = await neonApiRequest(`/projects/${projectId}/operations/${id}`);
      if (operation.status === 'finished' || operation.status === 'skipped') {
        pending.delete(id);
      } else if (operation.status === 'failed' || operation.status === 'error') {
        throw new Error(`Neon operation ${id} failed`);
      }
    }

    if (pending.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// Resets the dev branch to match the current head of the prod branch it was
// created from - an instant copy-on-write reset, not a row-by-row copy.
export async function resetDevBranchFromProd() {
  const projectId = process.env.NEON_PROJECT_ID!;
  const devBranchId = process.env.NEON_DEV_BRANCH_ID!;
  const prodBranchId = process.env.NEON_PROD_BRANCH_ID!;

  if (!devBranchId || !prodBranchId) {
    throw new Error('NEON_DEV_BRANCH_ID and NEON_PROD_BRANCH_ID must both be set');
  }
  if (devBranchId === prodBranchId) {
    throw new Error(
      'NEON_DEV_BRANCH_ID matches NEON_PROD_BRANCH_ID - refusing to reset the production branch onto itself'
    );
  }

  const { operations } = await neonApiRequest(
    `/projects/${projectId}/branches/${devBranchId}/restore`,
    {
      method: 'POST',
      body: JSON.stringify({ source_branch_id: prodBranchId }),
    }
  );

  await waitForOperations(
    projectId,
    (operations as { id: string }[]).map((op) => op.id)
  );
}
