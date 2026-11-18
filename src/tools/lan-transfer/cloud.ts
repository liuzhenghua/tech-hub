import { Peer } from 'peerjs';
import { ICE_CONFIG } from './ice';

export function createCloudPeer(id: string): Peer {
  return new Peer(id, { debug: 0, secure: true, config: ICE_CONFIG });
}
