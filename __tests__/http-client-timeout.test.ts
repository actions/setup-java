import {afterEach, describe, expect, it} from '@jest/globals';
import {HttpClient} from '@actions/http-client';
import net, {AddressInfo, Server, Socket} from 'node:net';

describe('@actions/http-client timeout cleanup', () => {
  let server: Server | undefined;
  const sockets = new Set<Socket>();

  afterEach(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    sockets.clear();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close(error => (error ? reject(error) : resolve()));
      });
      server = undefined;
    }
  });

  it('destroys a request whose socket times out', async () => {
    server = net.createServer({allowHalfOpen: true}, socket => {
      sockets.add(socket);
      socket.on('data', () => undefined);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server?.listen(0, '127.0.0.1', () => resolve());
      server?.once('error', reject);
    });

    const {port} = server.address() as AddressInfo;
    const client = new HttpClient('setup-java-timeout-test', [], {
      socketTimeout: 50
    });

    await expect(client.get(`http://127.0.0.1:${port}/jdk`)).rejects.toThrow(
      'Request timeout: /jdk'
    );
    await new Promise(resolve => setTimeout(resolve, 250));
    const activeHandles = (
      process as typeof process & {
        _getActiveHandles(): unknown[];
      }
    )._getActiveHandles();
    const openClientSockets = activeHandles.filter(
      (handle): handle is Socket =>
        handle instanceof Socket &&
        handle.remotePort === port &&
        !handle.destroyed
    );
    expect(openClientSockets).toHaveLength(0);
  });
});
