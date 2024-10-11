# Code base moved

Future development will be done here https://github.com/ringcentral/ringcentral-web-phone/tree/main


# RingCentral Web Phone 2

This is a complete rewrite of the RingCentral Web Phone SDK.

## Why rewrite?

The rewriting is to get rid of SIP.js.

### SIP.js is no longer actively maintained

The last release of SIP.js was in October 2022, and it hasn't been updated since. Depending on an unmaintained library poses risks, including potential incompatibility with future browser updates and WebRTC changes. By moving away from SIP.js, we ensure that our SDK remains compatible with evolving web standards.

### SIP.js lacks support for essential RingCentral features

SIP.js was not built with RingCentral’s specific requirements in mind. To support critical functionalities like confirming receipt, sending calls to voicemail, declining, forwarding, replying, call recording (start/stop), call flipping, and parking, we had to patch SIP.js heavily. Managing these patches was inefficient, and developing our own signaling library is a more sustainable approach.

### SIP signaling is simple enough to implement in-house

SIP signaling itself is a relatively straightforward protocol. By implementing the SIP signaling in-house, we can avoid the overhead and complexity introduced by SIP.js while gaining full control over the signaling flow.

### Decoupling SIP signaling from WebRTC

SIP.js tightly couples SIP signaling with WebRTC. By decoupling these two components, we allow you to run a web phone with a real/dummy SIP client, which is essential for scenarios where you need to run multiple web phones in multiple tabs. Please refer to the [Shared Worker](#mutiple-instances-and-shared-worker) section for more information.

## Demo

- [Online Demo](https://chuntaoliu.com/rc-web-phone-demo-2/)
- [Source Code](https://github.com/tylerlong/rc-web-phone-demo-2)

## Pre-requisites

This SDK assumes that you have basic knowledge of RingCentral Platform. You have created a RingCentral app and you know how to invoke RingCentral APIs. If you don't know how to do that, please read the following document first: https://developers.ringcentral.com/guide/voice/call-log/quick-start. The document is about how to create a RingCentral app and how to use the RingCentral API to access call log data. It is a good starting point for you to understand the RingCentral API. This SDK doesn't use/require call log API, the document is just for you to get familiar with RingCentral API.

This SDK assumes that you know how to invoke [Device SIP Registration](https://developers.ringcentral.com/api-reference/Device-SIP-Registration/createSIPRegistration) to get a `sipInfo` object.

With `@ringcentral/sdk`, it is done like this:

```ts
import { SDK } from '@ringcentral/sdk';

const rc = new SDK({
  server: process.env.RINGCENTRAL_SERVER_URL,
  clientId: process.env.RINGCENTRAL_CLIENT_ID,
  clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
});

const main = async () => {
  await rc.login({
    jwt: process.env.RINGCENTRAL_JWT_TOKEN,
  });
  const r = await rc.platform().post('/restapi/v1.0/client-info/sip-provision', {
    sipInfo: [{ transport: 'WSS' }],
  });
  const jsonData = await r.json();
  const sipInfo = jsonData.sipInfo[0];
  console.log(sipInfo); // this is what we need

  const deviceId = jsonData.device.id; // Web Phone SDK doesn't need `deviceId`, just for your information.
  await rc.logout(); // Web Phone SDK doesn't need a long-living Restful API access token, you MAY logout
};
main();
```

With `@rc-ex/core`, it is done like this:

```ts
import RingCentral from '@rc-ex/core';

const rc = new RingCentral({
  server: process.env.RINGCENTRAL_SERVER_URL,
  clientId: process.env.RINGCENTRAL_CLIENT_ID,
  clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
});

const main = async () => {
  await rc.authorize({
    jwt: process.env.RINGCENTRAL_JWT_TOKEN!,
  });
  const r = await rc
    .restapi()
    .clientInfo()
    .sipProvision()
    .post({
      sipInfo: [{ transport: 'WSS' }],
    });
  const sipInfo = r.sipInfo![0];
  console.log(sipInfo); // this is what we need

  const deviceId = r.device!.id; // Web Phone SDK doesn't need `deviceId`, just for your information.
  await rc.revoke(); // Web Phone SDK doesn't need a long-living Restful API access token, you MAY logout
};
main();
```

Please note that, you may save and re-use `sipInfo` for a long time. You don't need to invoke `Device SIP Registration` every time you start the web phone.

In the sample code above, I also showed you how to get the `deviceId`. Web Phone SDK doesn't need `deviceId`, it is just for your information.
Just in case you may need it for [RingCentral Call Control API](https://developers.ringcentral.com/api-reference/Call-Control/createCallOutCallSession).

## Installation

```
yarn add ringcentral-web-phone@2.0.0-beta.1
```

At the time I am writing this document, the latest version is `2.0.0-beta.1`.
Please replace it with the latest version.
Find the latest version here https://www.npmjs.com/package/ringcentral-web-phone

## Initialization

```ts
import WebPhone from 'ringcentral-web-phone';

const webPhone = new WebPhone({ sipInfo });
await webPhone.start();
```

What is `sipInfo`? Please read [Pre-requisites](#pre-requisites) section.

Optionally, you can specify `instanceId`: `new WebPhone({ sipInfo, instanceId })`.
`instanceId` is the unique ID of your web phone device.

If you want like to run multiple web phone devices in multiple tabs, you need to generate a unique `instanceId` for each device.
It MUST be persistent across power cycles of the device. It MUST NOT change as the device moves from one network to another.
Ref: https://datatracker.ietf.org/doc/html/rfc5626#section-4.1

If you start two web phone instances with the same `instanceId`, only the second instance will work. SIP server will not route calls to the first instance. (The first instance will still be able to make outbound calls, but it will not receive inbound calls.)

If you don't specify `instanceId`, the SDK by default will use `sipInfo.authorizationId` as `instanceId`. Which means, if you don't specify `instanceId`, you should only run one web phone instance in one tab.

If you start two web phone instances with different `instanceId`, both instances will work. SIP server will send messages to both instances.

## Debug Mode

```ts
const webPhone = new WebPhone({ sipInfo, debug: true });
```

In debug mode, the SDK will print all SIP messages to the console. It is useful for debugging.

## Make an outbound call

```ts
const callSession = await webPhone.call(callee, callerId);
```

`callee` is the phone number you want to call. Format is like `16506668888`.
`callerId` is the phone number you want to display on the callee's phone. Format is like `16506668888`.

To get all the `callerId` that you can use, you can call the following API: https://developers.ringcentral.com/api-reference/Phone-Numbers/listExtensionPhoneNumbers. Don't forget to filter the phone numbers that have `"features": [..., "CallerId", ...]`.

## Get inbound call sessions

To get inbound call sessions, you can listen to the `inboundCall` event:

```ts
webPhone.on('inboundCall', (inbundCallSession: InboundCallSession) => {
  // do something with the inbound call session
});
```

### Actions to take on inbound call session

#### Answer the call

```ts
await inbundCallSession.answer();
```

#### Decline the call

```ts
await inbundCallSession.decline();
```

Please note that, decline the inbound call will not terminate the call session for the caller immediately.
The caller will hear the ringback tone for a while until he/she hears "I am sorry, no one is available to take your call. Thank you for calling. Goodbye." And the call will not reach your voicemail.

#### Send the call to voicemail

```ts
await inbundCallSession.toVoicemail();
```

#### Forward the call

```ts
await inbundCallSession.forward(targetNumber);
```

#### Reply the call

Optionally, you can tell the server that the user has started replying the call.
The server will give the user more time to edit the reply message before ending the call or redirecting the call to voicemail.

```ts
await inbundCallSession.startReply();
```

Reply the call with text:

```ts
const response = await inbundCallSession.reply(text);
```

After this method call, the call session will be ended for the callee.
But the call session will not end yet for the caller. And the caller will receive the replied `text` via text-to-speech.
The caller will then have several options:

- press 1 to repeat the message
- press 2 to leave a voicemail
- press 3 to reply with "yes"
- press 4 to reply with "no"
- press 5 to reply with "urgent, please call immediately"
  - the caller will be prompted to specify a callback number
- press 6 to to disconnect

`if (response.body.Sts === '0')`, it means that the caller replied to your message(he/she pressed 3, 4, 5).
Then you need to check `response.body.Resp`:

- if it's `'1'`, it means that the caller replied with "yes" (he/she pressed 3)
- if it's `'2'`, it means that the caller replied with "no" (he/she pressed 4)
- if it's `'3'`, it means that the caller replied with "urgent, please call [number] immediately". (he/she pressed 5)
  - in this case, there is also an urgent number provided by the caller which can be accessed by `response.body.ExtNfo`.

Below is some code snippet for your reference:

```ts
const response = await session.reply('I am busy now, can I call you back later?');
if (response.body.Sts === '0') {
  const message = `${response.body.Phn} ${response.body.Nm}`;
  let description = '';
  switch (response.body.Resp) {
    case '1':
      description = 'Yes';
      break;
    case '2':
      description = 'No';
      break;
    case '3':
      description = `Urgent, please call ${response.body.ExtNfo} immediately!`;
      break;
    default:
      break;
  }
  global.notifier.info({
    message, // who replied
    description, // what replied
    duration: 0,
  });
}
```

## Actions to take on answered call sessions

This part applies to both inbound and outbound call sessions.
Once the call is answered, you can do the following actions:

### Transfer the call

#### "Cold" transfer

It is also called blind transfer. Transfer the call to another number directly, without any introduction or context to the person to whom the call will be transferred (the transferee).

```ts
await callSession.transfer(targetNumber);
```

#### "Warm" transfer

The original caller is placed on hold while the person handling the call (the transferor) speaks with the person to whom the call will be transferred (the transferee). The transferor introduces the caller, provides context, and confirms that the transferee is ready to take the call before connecting the two.

```ts
const { complete, cancel } = await session.warmTransfer(transferToNumber);
```

After this method call, the current call session will be put on hold.
A new call session will be created to the `transferToNumber`. Then the transferor will have a chance to talk to the transferee.
After that, depending on the transferor's decision, the app can call `complete()` to complete the transfer, or call `cancel()` to cancel the transfer.

### Hang up the call

```ts
await callSession.hangup();
```

### Start/Stop call recording

```ts
await callSession.startRecording();
await callSession.stopRecording();
```

### Flip the call

```ts
const result = await callSession.flip(targetNumber);
```

Most popular use case of call flip is for you to switch the current call to your other devices.
Let's say you are talking to someone on your desktop, and you want to switch to your mobile phone.
You can use call flip to achieve this: `await callSession.flip(mobilePhoneNumber)`.

Please note that, after you mobile phone answers the call, you need to **manually** end the call session on your desktop, otherwise you won't be able to talk/listen on your mobile phone.

Please also note that, this SDK allows you to flip the call to any phone number, not just your own phone numbers. But if it is not your number, you probably should transfer the call instead of flipping the call.

A sample result of `flip` is like this:

```json
{
  "code": 0,
  "description": "Succeeded",
  "number": "+16506668888",
  "target": "16506668888"
}
```

I don't think you need to do anything based on the result. It is just for your information.

### Park the call

```ts
const result = await callSession.park();
```

After this method call, the call session will be ended for you. And the remote peer will be put on hold and parked on an extension.
You will be able to retrieve the parked call by dailing `*[parked-extension]`.
Sample result:

```json
{
  "code": 0,
  "description": "Succeeded",
  "park extension": "813"
}
```

Take the sample result above as an example, you can retrieve the parked call by dailing `*813`.

### Hold/Unhold the call

```ts
await callSession.hold();
await callSession.unhold();
```

If you put the call on hold, the remote peer will hear hold music. Neither you nor the remote peer can hear each other.
If you unhold the call, you and the remote peer can hear each other again.

### Mute/Unmute the call

```ts
await callSession.mute();
await callSession.unmute();
```

If you mute the call, the remote peer can't hear you.
If you unmute the call, the remote peer can hear you again.

### Send DTMF

```ts
await callSession.sendDTMF(dtmf);
```

`dtmf` is a string, like `*123#`. Valid characters are `0123456789*#ABCD`.
`ABCD` are less commonly used but are part of the DTMF standard. They were originally intended for special signaling in military and network control systems.

Receving DTMF is not supported. Because it's not supported by WebRTC.

## Events

You may subscribe to events, examples:

```ts
webPhone.on('inboundCall', (inboundCall: InboundCallSession) => {
  // do something with the inbound call
});
```

```ts
callSession.on('disposed', () => {
  // do something when the call session is disposed
});
```

### WebPhone Events

- inboundCall
  - new inbound call session, payload type: [InboundCallSession](./src/call-session/inbound.ts)
- outboundCall
  - new outbound call session, payload type: [OutboundCallSession](./src/call-session/outbound.ts)

### CallSession Events

- ringing
- answered
- disposed

## Conference

Conference is out of the scope of this SDK. Because conferences are mainly done with Restful API.
With above being said, I will provide some code snippets for your reference.

### Create a conference

To create a conference: https://developers.ringcentral.com/api-reference/Call-Control/createConferenceCallSession
If you are using SDK `@rc-ex/core`, you can do it like this:

```ts
const r = await rc.restapi().account().telephony().conference().post();
```

In the response of the above API call, you will get a `r.session!.voiceCallToken!`.
As the host, you will need to dial in:

```ts
const confSession = await webPhone.call(r.session!.voiceCallToken!);
```

### Invite a number to the conference

Make a call to the number you want to invite to the conference:

```ts
const callSession = await this.webPhone.call(targetNumber);
```

Then you can bring in the call to the conference.

```ts
await rc.restapi().account().telephony().sessions(confSession.sessionId).parties().bringIn().post({
  sessionId: callSession.sessionId,
  partyId: callSession.partyId,
});
```

### Merge an existing ongoing call to the conference

Let's say an existing call session is `callSession`.

```ts
await rc.restapi().account().telephony().sessions(confSession.sessionId).parties().bringIn().post({
  sessionId: callSession.sessionId,
  partyId: callSession.partyId,
});
```

You can see that it doesn't matter how the call is created, it could be either an outbound call or an inbound call.
You could create it on-the-fly or you can find an existing call session.

### A live sample

https://github.com/tylerlong/rc-web-phone-demo-2 provides conference features.
You may create conference, invite a number to the conference, merge an existing call to the conference, etc.

## Recover from network outage

If you believe your app just recovered from network outage and the underlying websocket connection is broken, you may call `webPhone.start()`.
It will create a brand new websocket connection to the SIP server and re-register the SIP client.

## Breaking changes

### API changes

2.x version is a complete rewrite of the RingCentral Web Phone SDK.
The API is completely different from 1.x version.

### Behavior changes

#### ringing audio

This SDK doesn't play ringing audio when there is incoming call or outgoing call.
It's up to the developer/app to play the audio. It's a by design change.

We made this change because we want to give the developer/app more flexibility.
And playing ringing audio is not a core feature of the SDK. It's more about how the app interacts with end users.

#### call forward

SDK 1.x treats forwarding as answering the call and then transfer the call.
SDK 2.x treats forwarding as sending a SIP message to the SIP server to forward the call.
I would like to say this is more like a bug fix than a behavior change.

#### `<audio />`

SDK 1.x requires you to provide `<audio />` elements to play remote audio.
SDK 2.x will create `<audio />` elements on demand. You don't need to provide `<audio />` elements.

## Mutiple instances and shared worker

Some application allows users to open multiple tabs to run multiple instances.
If you want all of the web phones to work properly, you need to assign them different `instanceId`.
If you don't know what is `instanceId`, please read [Initialization](#initialization) section.

But there is a limit of how many instances you can run for each extension. What if the user opens too many tabs?
A better solution is to have one tab run a "real" phone while all other tabs run "dummy" phones. Dummy phones don't register itself to RingCentral Server. Real phone syncs its state to all dummy phones so that dummy phones are always in sync with the real phone.
When user performs an action on a dummy phone, the dummy phone forwards the action to the real phone. The real phone then performs the action and syncs the state back to all dummy phones.

In order to achieve this, you will need to use [SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker).

1. The real phone sends state to SharedWorker. SharedWorker sends state to all dummy phones. Dummy phones update their state and UI. So that dummy phones look identical to the real phone.
2. When end user performs an action on a dummy phone, the dummy phone forwards the action to SharedWorker. SharedWorker forwards the action to the real phone. The real phone performs the action and update its state. Go to step 1.

When the real phone quits (tab closing, navigating to another page, etc), a dummy phone will be prompted to a real phone.

This way, there is always one and only one real phone. All other phones are dummy phones. Dummy phones always look identical to a real phone because they will always get the latest state of a real phone. All actions are performed by the real phone.

### Technical details

A real phone is initiated like this:

```ts
import SipClient from 'ringcentral-web-phone/sip-client';

new WebPhone({ sipInfo, sipClient: new SipClient({ sipInfo }) });
```

Or even simpler (since `sipClient` is optional with default value `new SipClient({ sipInfo })`):

```ts
new WebPhone({ sipInfo });
```

A dummy phone is initiated like this:

```ts
import { DummySipClient } from 'ringcentral-web-phone/sip-client';

new WebPhone({ sipInfo, sipClient: new DummySipClient() });
```

You may need to re-initiate a dummy phone to a real phone when the previous real phone quits.

A `DummySipClient` doesn't register itself to RingCentral Server. It doesn't send any SIP messages to RingCentral Server. It does nothing.

You will need to implement a SharedWorker to:

- sync the state from the real phone to all dummy phones.
- forward actions from dummy phones to the real phone.

### Sample SharedWorker

```ts
const dummyPorts = new Set<MessagePort>();
let realPort: MessagePort | undefined;

let syncCache: any;
self.onconnect = (e) => {
  const port = e.ports[0];
  if (realPort) {
    dummyPorts.add(port);
    port.postMessage({ type: 'role', role: 'dummy' });
  } else {
    realPort = port;
    port.postMessage({ type: 'role', role: 'real' });
  }
  port.onmessage = (e) => {
    // a new dummy is ready to receive state
    if (e.data.type === 'ready') {
      if (port !== realPort && syncCache) {
        port.postMessage(syncCache);
      }
    }
    // a tab closed
    else if (e.data.type === 'close') {
      if (port === realPort) {
        realPort = undefined;

        // if real closes, all call sessions are over.
        dummyPorts.forEach((dummyPort) => dummyPort.postMessage({ type: 'sync', jsonStr: '[]' }));

        // prompt a dummy to be a real
        if (dummyPorts.size > 0) {
          realPort = Array.from(dummyPorts)[0];
          dummyPorts.delete(realPort);
          realPort.postMessage({ type: 'role', role: 'real' });
        }
      } else {
        dummyPorts.delete(port);
      }
    } else if (e.data.type === 'action') {
      // forward action to real
      if (realPort) {
        realPort.postMessage(e.data);
      }
    } else if (e.data.type === 'sync') {
      // sync state to all dummies
      syncCache = e.data;
      dummyPorts.forEach((dummyPort) => dummyPort.postMessage(e.data));
    }
  };
};
```

### Sample client code

```ts
worker.port.onmessage = (e) => {
  if (e.data.type === 'role') {
    // role assigned/updated
    store.role = e.data.role;
    // you may need to (re-)initiate the web phone
  } else if (store.role === 'real' && e.data.type === 'action') {
    // real gets action from dummy
  } else if (store.role === 'dummy' && e.data.type === 'sync') {
    // dummy gets state from real
  }
};
```

### A sample action processing code

```ts
public async transfer(callId: string, transferToNumber: string) {
  if (this.role === 'dummy') {
    worker.port.postMessage({ type: 'action', name: 'transfer', args: { callId, transferToNumber } });
    return;
  }
  await this.webPhone.callSessions.find((cs) => cs.callId === callId)!.transfer(transferToNumber);
}
```

### Working sample

A fully working sample is here https://github.com/tylerlong/rc-web-phone-demo-2/tree/shared-worker
You may run mutiple tabs to see how it works.

# Maintainers Notes

Content below is for the maintainers of this project.

## webPhone vs webPhone.sipClient

`webPhone` is mainly about call sessions and WebRTC.
`webPhone.sipClient` is mainly about SIP signaling.
We would like to decouple these two.

### References

- ref: https://www.ietf.org/rfc/rfc3261.txt

### How to test

rename `.env.sample` to `.env` and fill in the correct values.
You will need two RingCentral extensions to test the SDK, one as the caller and the other as the callee.
You will need the `sipInfo` json string of the two extensions. Invoke [this API](https://developers.ringcentral.com/api-reference/Device-SIP-Registration/createSIPRegistration) to get `sipInfo`.

You may need to `yarn playwright install chromium` if playwright cannot find chromium.

You will need one more number to test call forwarding/transferring.

To run all tests:

```
yarn test
```

To run a test file:

```
yarn test test/inbound/forward.spec.ts
```

### Two kinds of special messages

Before an incoming call is answered, client may send special messages with **XML** body to confirmReceive/toVoicemail/decline/forward/reply the call.

In an ongoing call (either inbound or outbound), client may send special messages with **JSON** body to startCallRecord/stopCallRecord/flip/park the call.

### webPhone unregister

Register the SIP client with expires time 0. It means that the SIP client will be unregistered immediately after the registration.
After this method call, no incoming call will be received. If you try to make an outbound call, you will get a `SIP/2.0 403 Forbidden` response.

### Call-Id

SIP headers are case insensitive. SIP server INVITE message uses Call-Id, so this project uses Call-Id.

Caller outbound INVITE and callee inbound INVITE don't have the same Call-Id. They are different. I am not sure it is a bug or not.

### multiple instances

Every time you get a new `sipInfo`, you will get a new `authorizationId`. So different instances will have different `authorizationId`, unless you share the same `sipInfo`.

If there are 3 instances, after an incoming call is answered, each instance will receive 3 messages with Cmd="7" with different Cln="xxx". "xxx" here is authorizationId.

## Todo:

- generate api reference
- test recovery from computer sleep
