const { WebClient, LogLevel } = require('@slack/web-api');
const web = new WebClient("xoxb-2777428522-1916166850306-7jaSIEug0AWmVh3Su8KXIRq8", {
    logLevel: LogLevel.DEBUG
});
const fs = require('fs');
const moment = require('moment');
const express = require('express');

const app = express();
const port = 8080;

//const conversationId = 'C01SH5WC2P9'; // testing
const conversationId = 'CKG919Y8H'; // pi-support

const isInProgress = (reactions) => {
    for(let reaction of reactions) {
        if(reaction.name === 'eyes' || reaction.name === 'ok') {
            return true;
        }
    }
    
    return false;
};

const isDone = (reactions) => {
    for(let reaction of reactions) {
        if(reaction.name === 'white_check_mark') {
            return true;
        }
    }
    
    return false;
};

const generateReport = async () => {
    try {
        const chatHistory = await web.conversations.history({
            channel: conversationId,
            limit: 1000 // TODO: remove this and add cursor usage
        });
        
        // resolve links to messages for weekly ones
        chatHistory.messages = await Promise.all(chatHistory.messages.map(async (msg) =>{
            const date = moment.unix(msg.ts).add(7, 'days');
            const now = moment();
            if(date > now) {
                let pLink = await web.chat.getPermalink({
                   channel: conversationId,
                   message_ts: msg.ts
                });
                msg.link = pLink.permalink;
            }
            
            return msg;
        }));
        
        let inProgressMsgs = [];
        let doneMsgs = [];
        let unknownMsgs = [];
        let weeklyUnknownMsgs = [];
        let weeklyDoneMsgs = [];
        let weeklyInProgressMsgs = [];
        for(let msg of chatHistory.messages) {
            if(msg.subtype !== 'channel_join') {
                const date = moment.unix(msg.ts).add(7, 'days');
                const now = moment();
                
                if(msg.reactions) {
                    if(isDone(msg.reactions)) {
                        doneMsgs.push(Object.assign({}, msg));
                        if(date > now) {
                            weeklyDoneMsgs.push(Object.assign({}, msg));
                        }
                    } else if(isInProgress(msg.reactions)) {
                        inProgressMsgs.push(Object.assign({}, msg));
                        if(date > now) {
                            weeklyInProgressMsgs.push(Object.assign({}, msg));
                        }
                    } else {
                        unknownMsgs.push(Object.assign({}, msg));
                        if(date > now) {
                            weeklyUnknownMsgs.push(Object.assign({}, msg));
                        }
                    }
                } else {
                    unknownMsgs.push(Object.assign({}, msg));
                    if(date > now) {
                        weeklyUnknownMsgs.push(Object.assign({}, msg));
                    }
                }
            }
        }
        
        let msgCounter = 0;
        let report =
        '<div id="div1">' +
          '<h1>Not addressed request(s):' + unknownMsgs.length +
          ' ----- In progress request(s):' + inProgressMsgs.length +
          ' ----- Done request(s):' + doneMsgs.length + '</h1>' +
          '<h4>Weekly not addressed request(s):' + weeklyUnknownMsgs.length + '</h4>';
        
        for (let m of weeklyUnknownMsgs) {
            report += `<p id="p${msgCounter++}"><a href=${m.link}>Click here to see more details - ${-moment.unix(m.ts).diff(moment.now(), 'days')} day(s) ago</a></p>`;
        }
        report +=
        '<h4>Weekly in progress request(s):' + weeklyInProgressMsgs.length + '</h4>';
        for (let m of weeklyInProgressMsgs) {
            report += `<p id="p${msgCounter++}"><a href=${m.link}>Click here to see more details - ${-moment.unix(m.ts).diff(moment.now(), 'days')} day(s) ago</a></p>`;
        }
        report +=
        '<h4>Weekly done request(s):' + weeklyDoneMsgs.length + '</h4>';
        for (let m of weeklyDoneMsgs) {
            console.log(m)
            report += `<p id="p${msgCounter++}"><a href=${m.link}>Click here to see more details - ${-moment.unix(m.ts).diff(moment.now(), 'days')} day(s) ago</a></p>`;
        }
        report +=
        '</div>';
        
        fs.writeFileSync('./report.html', report);
        // post to channel
        /*
        const resp = await web.chat.postMessage({
            text: result,
            channel: conversationId
        });
        */
        return report;
    } catch(e) {
        console.log(`An error occured ${e}`);
    }
};

app.get('/reports', async (req, res) => {
  res.send(await generateReport());
});

app.listen(port, () => {
  console.log(`Report generator listening at http://localhost:${port}`)
});


