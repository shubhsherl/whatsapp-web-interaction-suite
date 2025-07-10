/** Global variables for campaign state */
let activeCampaigns = {};
let wakeLock = null;

/** Listen port.postMessage from content.js */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'contentjsToBackground') {
        console.log("BG Received Message", request);
        sendWhatsappMessage(request, sendResponse);
        return true;
    } else if (request.action === 'enableKeepAwake') {
        // Enable wake lock for a campaign
        enableWakeLock(request.campaignId);
        sendResponse({ success: true });
        return true;
    } else if (request.action === 'disableKeepAwake') {
        // Disable wake lock for a campaign
        disableWakeLock(request.campaignId);
        sendResponse({ success: true });
        return true;
    } else if (request.action === 'getCampaignStatus') {
        // Return the status of active campaigns
        sendResponse({ 
            activeCampaigns: activeCampaigns,
            hasActiveCampaign: Object.keys(activeCampaigns).length > 0
        });
        return true;
    }
});

/** 
 * Enable wake lock for a campaign 
 * This keeps the extension running even when the popup is closed
 */
async function enableWakeLock(campaignId) {
    // Add campaign to active campaigns
    activeCampaigns[campaignId] = {
        startTime: Date.now(),
        active: true
    };
    
    console.log(`Wake lock enabled for campaign ${campaignId}`);
    
    // If this is the first active campaign, request wake lock
    if (Object.keys(activeCampaigns).length === 1) {
        try {
            // Use a service worker to keep the extension alive
            chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
        } catch (err) {
            console.error(`Error enabling wake lock: ${err.message}`);
        }
    }
}

/**
 * Disable wake lock for a campaign
 */
function disableWakeLock(campaignId) {
    // Remove campaign from active campaigns
    if (activeCampaigns[campaignId]) {
        delete activeCampaigns[campaignId];
        console.log(`Wake lock disabled for campaign ${campaignId}`);
    }
    
    // If no active campaigns, release wake lock
    if (Object.keys(activeCampaigns).length === 0) {
        try {
            chrome.alarms.clear('keepAlive');
            console.log('All wake locks released');
        } catch (err) {
            console.error(`Error disabling wake lock: ${err.message}`);
        }
    }
}

// Set up alarm handler to keep the service worker alive
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
        // Check if we still have active campaigns
        if (Object.keys(activeCampaigns).length > 0) {
            console.log('Keep-alive ping for active campaigns');
            
            // Clean up any campaigns that are more than 2 hours old
            const now = Date.now();
            const twoHoursMs = 2 * 60 * 60 * 1000;
            
            Object.keys(activeCampaigns).forEach(campaignId => {
                if (now - activeCampaigns[campaignId].startTime > twoHoursMs) {
                    console.log(`Auto-cleaning campaign ${campaignId} after 2 hours`);
                    delete activeCampaigns[campaignId];
                }
            });
            
            // If we still have active campaigns, keep the alarm
            if (Object.keys(activeCampaigns).length === 0) {
                chrome.alarms.clear('keepAlive');
                console.log('All campaigns finished, releasing wake lock');
            }
        } else {
            // No active campaigns, clear the alarm
            chrome.alarms.clear('keepAlive');
        }
    }
});

/** trigger event on whatsapp tab */
async function sendWhatsappMessage(msg, sendResponse) {
    const [tab] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*'});

    if(!tab) {
        sendResponse({
            response : "Whatsapp is not runnung, please open whatsapp.",
            success: false,
        });
        return;
    }

    let messageData = {
        action: 'backgroundToWhatsapp',
        text: msg.text,
        receiver: msg.mobile,
        internalOptions: {},
        uid: msg.uid || generateUniqueId(),
    };

    try {
        if(msg.url && isURL(msg.url)) {
            messageData.internalOptions = {
                linkPreview: true,
            };
            messageData.internalOptions.attachment = await downloadMediaFromUrl(msg.url);
            messageData.internalOptions.caption = msg.text,
            messageData.text = '';
        }
        else if(typeof msg.media == 'object') {
            messageData.internalOptions.attachment = {
                // data: msg.media.data.replace(/^data:[a-z]+\/[a-z]+;base64,/, ''),
                data: msg.media.data,
                mimetype: msg.media.mime, 
                filename: msg.media.filename, 
                filesize: msg.media.filesize 
            }
            messageData.internalOptions.caption = msg.text,
            messageData.text = '';
        }
    
        const response = await chrome.tabs.sendMessage(tab.id, messageData);
        console.log("Response in Background: ", response);
    
        sendResponse(response);   
    } catch (error) {
        console.log(error);
        sendResponse({
            response : "Error while sending message",
            success: false,
            error: error,
        });
    }
}

async function downloadMediaFromUrl(url, options = {}) {
    const pUrl = new URL(url);
    
    async function fetchData (url, options) {
        const reqOptions = Object.assign({ headers: { accept: 'image/* video/* text/* audio/* application/pdf ' } }, options);
        const response = await fetch(url);
        const mime = response.headers.get('Content-Type');
        const size = response.headers.get('Content-Length');

        const contentDisposition = response.headers.get('Content-Disposition');
        const name = contentDisposition ? contentDisposition.match(/((?<=filename=")(.*)(?="))/) : "800x500.png";

        let data = '';
        if (response.buffer) {
            data = (await response.buffer()).toString('base64');
        } else {
            const bArray = new Uint8Array(await response.arrayBuffer());
            bArray.forEach((b) => {
                data += String.fromCharCode(b);
            });
            data = btoa(data);
        }
        
        return { 
            data: data, 
            mimetype: mime, 
            filename: name, 
            filesize: size 
        };
    }

    const res = (await fetchData(url));

    return res;
}


function isBlob(data) {
    return data instanceof Blob;
}
  
// Check if the data contains Base64 data
function isBase64(data) {
    // Regular expression to match Base64 pattern
    const base64Regex = /^data:(.+\/.+);base64,(.*)$/;

    return typeof data === 'string' && base64Regex.test(data);
}

function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch (error) {
        return false;
    }
}

function generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return timestamp + randomStr;
}
