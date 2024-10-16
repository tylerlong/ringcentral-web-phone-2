import type EventEmitter from './event-emitter';
import type InboundMessage from './sip-message/inbound';
import type RequestMessage from './sip-message/outbound/request';
import type ResponseMessage from './sip-message/outbound/response';

export interface SipClientOptions {
  sipInfo: SipInfo;
  instanceId?: string; // ref: https://docs.oracle.com/cd/E95618_01/html/sbc_scz810_acliconfiguration/GUID-B2A15693-DA4A-4E24-86D4-58B19435F4DA.htm
  debug?: boolean;
}

export type WebPhoneOptions = SipClientOptions & {
  sipClient?: ISipClient;
};

export interface SipInfo {
  authorizationId: string;
  domain: string;
  outboundProxy: string;
  username: string;
  password: string;
  stunServers: string[];
}

export type ISipClient = EventEmitter & {
  start: () => Promise<void>;
  request: (message: RequestMessage) => Promise<InboundMessage>;
  reply: (message: ResponseMessage) => Promise<void>;
  dispose: () => Promise<void>;
};
