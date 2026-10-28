import { gitSync } from '../../../scripts/fleet/git/exec.mts'

export const BLOB_BATCH_MAX_OBJECTS = 256
export const BLOB_BATCH_MAX_BYTES = 8 * 1024 * 1024
const MAX_BLOB_BYTES = 64 * 1024 * 1024
const GIT_TIMEOUT_MS = 30_000

export interface BlobMetadata {
  readonly oid: string
  readonly size: number
}

function gitOutput(
  args: string[],
  cwd: string,
  input: string | Buffer,
  maxBuffer: number,
): Buffer {
  const result = gitSync(args, {
    cwd,
    input: Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8'),
    maxBuffer,
    timeout: GIT_TIMEOUT_MS,
    stdioString: false,
  })
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error(
      `Could not inspect committed Git blobs. Where: ${cwd}. Saw: git exit ${result.status ?? 1}. Fix: fetch the push baseline and retry the security scan.`,
    )
  }
  return result.stdout
}

function validOid(oid: string): boolean {
  return /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(oid)
}

export function readBlobMetadata(
  oids: readonly string[],
  cwd: string,
): BlobMetadata[] {
  const unique = [...new Set(oids)]
  if (unique.some(oid => !validOid(oid)))
    throw new Error(
      'Invalid committed Git blob ID. Fix: retry the security scan with a valid commit.',
    )
  const result: BlobMetadata[] = []
  for (
    let offset = 0;
    offset < unique.length;
    offset += BLOB_BATCH_MAX_OBJECTS
  ) {
    const group = unique.slice(offset, offset + BLOB_BATCH_MAX_OBJECTS)
    const output = gitOutput(
      ['cat-file', '--batch-check'],
      cwd,
      `${group.join('\n')}\n`,
      1024 * 1024,
    )
    if (output.some(byte => byte > 0x7f))
      throw new Error(
        'Malformed committed Git blob metadata. Fix: retry the security scan.',
      )
    const lines = output.toString('utf8').split('\n')
    if (lines.length !== group.length + 1 || lines.at(-1) !== '')
      throw new Error(
        'Malformed committed Git blob metadata. Fix: retry the security scan.',
      )
    for (let i = 0; i < group.length; i += 1) {
      const fields = lines[i]!.split(' ')
      const size = Number(fields[2])
      if (
        fields.length !== 3 ||
        fields[0] !== group[i] ||
        fields[1] !== 'blob' ||
        !/^(?:0|[1-9][0-9]*)$/u.test(fields[2]!) ||
        !Number.isSafeInteger(size)
      )
        throw new Error(
          'Invalid committed Git blob metadata. Fix: retry the security scan.',
        )
      result.push({ oid: group[i]!, size })
    }
  }
  return result
}

export function readBlobBodies(
  metadata: readonly BlobMetadata[],
  cwd: string,
  consume: (oid: string, body: Buffer) => void,
): void {
  let group: BlobMetadata[] = []
  let expected = 0
  function flush(): void {
    if (group.length === 0) return
    const output = gitOutput(
      ['cat-file', '--batch'],
      cwd,
      `${group.map(blob => blob.oid).join('\n')}\n`,
      expected + group.length * 128 + 1,
    )
    let cursor = 0
    for (const blob of group) {
      const newline = output.indexOf(10, cursor)
      if (newline < 0)
        throw new Error(
          'Truncated committed Git blob header. Fix: retry the security scan.',
        )
      const header = Buffer.from(`${blob.oid} blob ${blob.size}\n`, 'ascii')
      if (!output.subarray(cursor, newline + 1).equals(header))
        throw new Error(
          'Unexpected committed Git blob header. Fix: retry the security scan.',
        )
      cursor = newline + 1
      const end = cursor + blob.size
      if (end >= output.length || output[end] !== 10)
        throw new Error(
          'Truncated committed Git blob body. Fix: retry the security scan.',
        )
      consume(blob.oid, output.subarray(cursor, end))
      cursor = end + 1
    }
    if (cursor !== output.length)
      throw new Error(
        'Extra committed Git blob output. Fix: retry the security scan.',
      )
    group = []
    expected = 0
  }
  for (const blob of metadata) {
    const size =
      blob.size +
      Buffer.byteLength(`${blob.oid} blob ${blob.size}\n\n`, 'ascii')
    if (size > BLOB_BATCH_MAX_BYTES || blob.size > MAX_BLOB_BYTES) {
      flush()
      const output = gitOutput(
        ['cat-file', 'blob', blob.oid],
        cwd,
        Buffer.alloc(0),
        MAX_BLOB_BYTES,
      )
      if (output.length !== blob.size)
        throw new Error(
          'Unexpected committed Git blob size. Fix: retry the security scan.',
        )
      consume(blob.oid, output)
    } else {
      if (
        group.length > 0 &&
        (group.length >= BLOB_BATCH_MAX_OBJECTS ||
          expected + size > BLOB_BATCH_MAX_BYTES)
      )
        flush()
      group.push(blob)
      expected += size
    }
  }
  flush()
}
