import RingCentral from '@rc-ex/core';

import WebPhone from '../src';

global.initWebPhone = async (jwt: string) => {
  const rc = new RingCentral({
    server: process.env.RINGCENTRAL_SERVER_URL,
    clientId: process.env.RINGCENTRAL_CLIENT_ID,
    clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
  });
  await rc.authorize({ jwt });
  const r = await rc
    .restapi()
    .clientInfo()
    .sipProvision()
    .post({
      sipInfo: [{ transport: 'WSS' }],
    });
  const sipInfo = r.sipInfo![0];
  await rc.revoke();
  const webPhone = new WebPhone({ sipInfo });
  global.webPhone = webPhone;
  global.inboundCalls = [];
  global.outboundCalls = [];
  webPhone.on('inboundCall', (call) => {
    global.inboundCalls.push(call);
  });
  webPhone.on('outboundCall', (call) => {
    global.outboundCalls.push(call);
  });
};
