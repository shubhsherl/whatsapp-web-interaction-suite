// Global variables
let selectedFile = null;
let messageHistory = [];
let currentHistoryPage = 1;
let historyItemsPerPage = 5;
let historyFilters = {
    type: 'all',
    status: 'all',
    search: ''
};
let savedTemplates = [];
let campaignInProgress = false;
let currentRecipientIndex = 0;
let currentCampaignId = null;
let appSettings = {
    randomDelayEnabled: true,
    maxDelaySeconds: 300, // 5 minutes
    pauseAfterBatch: false,
    pauseMinutes: 5,
    batchSize: 40,
    preventSleep: false
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadMessageHistory();
    loadSavedTemplates();
    loadSettings();
    populateTemplateDropdowns();
    initializeEventListeners();
    loadVersionInfo();
    checkForActiveCampaigns();
    
    // Template options are now always visible in HTML
});

// Check if there are any active campaigns running in the background
function checkForActiveCampaigns() {
    chrome.runtime.sendMessage({ action: 'getCampaignStatus' }, function(response) {
        if (response && response.hasActiveCampaign) {
            // Show a notification that campaigns are running in the background
            const notification = document.createElement('div');
            notification.className = 'status info';
            notification.style.position = 'fixed';
            notification.style.bottom = '60px';
            notification.style.left = '20px';
            notification.style.right = '20px';
            notification.style.zIndex = '1000';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '8px';
            notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <span style="font-weight: 500;">🚀 Campaign running in background</span>
                        <div style="font-size: 12px; margin-top: 4px;">Your messages are being sent even with this popup closed.</div>
                    </div>
                    <button id="closeNotification" style="background: transparent; border: none; cursor: pointer; padding: 5px;">✕</button>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            document.getElementById('closeNotification').addEventListener('click', function() {
                document.body.removeChild(notification);
            });
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 10000);
        }
    });
}

// Initialize all event listeners
function initializeEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
            
            if (tabName === 'history') {
                renderHistoryList();
            } else if (tabName === 'templates') {
                renderSavedTemplates();
            }
        });
    });
    
    // Send option switching (Single/Multiple)
    document.querySelectorAll('.send-option').forEach(option => {
        option.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            const optionType = this.getAttribute('data-option');
            switchSendOption(tabName, optionType);
        });
    });
    
    // Recipients method switching
    document.getElementById('textRecipientsMethod').addEventListener('change', function() {
        switchRecipientsMethod('text', this.value);
    });
    document.getElementById('urlRecipientsMethod').addEventListener('change', function() {
        switchRecipientsMethod('url', this.value);
    });
    document.getElementById('fileRecipientsMethod').addEventListener('change', function() {
        switchRecipientsMethod('file', this.value);
    });
    
    // Send buttons
    document.getElementById('textBtn').addEventListener('click', sendTextMessage);
    document.getElementById('urlBtn').addEventListener('click', sendUrlMessage);
    document.getElementById('fileBtn').addEventListener('click', sendFileMessage);
    
    // Template functionality
    document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
    document.getElementById('exportTemplatesBtn').addEventListener('click', exportTemplatesToFile);
    document.getElementById('importTemplatesBtn').addEventListener('click', () => document.getElementById('templatesFileInput').click());
    document.getElementById('templatesFileInput').addEventListener('change', importTemplatesFromFile);
    
    // Template selection dropdowns
    const textTemplateSelect = document.getElementById('textTemplateSelect');
    if (textTemplateSelect) {
        textTemplateSelect.addEventListener('change', function() {
            applyTemplateFromDropdown('text', this.value);
        });
    }
    
    const urlTemplateSelect = document.getElementById('urlTemplateSelect');
    if (urlTemplateSelect) {
        urlTemplateSelect.addEventListener('change', function() {
            applyTemplateFromDropdown('url', this.value);
        });
    }
    
    const fileTemplateSelect = document.getElementById('fileTemplateSelect');
    if (fileTemplateSelect) {
        fileTemplateSelect.addEventListener('change', function() {
            applyTemplateFromDropdown('file', this.value);
        });
    }
    
    // Template variables
    document.querySelectorAll('.variable-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            insertVariable(this.getAttribute('data-variable'));
        });
    });
    
    // File handling
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('mediaUrl').addEventListener('input', previewUrl);
    
    // CSV file uploads
    document.getElementById('textCsvFile').addEventListener('change', (e) => handleCsvUpload(e, 'text'));
    document.getElementById('urlCsvFile').addEventListener('change', (e) => handleCsvUpload(e, 'url'));
    document.getElementById('fileCsvFile').addEventListener('change', (e) => handleCsvUpload(e, 'file'));
    
    // History functionality
    document.getElementById('exportHistoryBtn').addEventListener('click', exportHistoryToCsv);
    document.getElementById('importHistoryBtn').addEventListener('click', () => document.getElementById('historyFileInput').click());
    document.getElementById('historyFileInput').addEventListener('change', importHistoryFromFile);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearMessageHistory);
    document.getElementById('prevPageBtn').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPageBtn').addEventListener('click', () => changePage(1));
    
    // History filters
    document.getElementById('historyTypeFilter').addEventListener('change', function() {
        historyFilters.type = this.value;
        currentHistoryPage = 1;
        renderHistoryList();
    });
    document.getElementById('historyStatusFilter').addEventListener('change', function() {
        historyFilters.status = this.value;
        currentHistoryPage = 1;
        renderHistoryList();
    });
    document.getElementById('historySearch').addEventListener('input', function() {
        historyFilters.search = this.value;
        currentHistoryPage = 1;
        renderHistoryList();
    });
    
    // Settings functionality
    document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
}

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Add active class to clicked tab
    const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
}

// Switch between single and multiple send options
function switchSendOption(tabName, optionType) {
    // Update button states
    document.querySelectorAll(`[data-tab="${tabName}"].send-option`).forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"][data-option="${optionType}"]`).classList.add('active');
    
    // Show/hide appropriate sections
    const singleSection = document.getElementById(`${tabName}SingleRecipient`);
    const multipleSection = document.getElementById(`${tabName}MultipleRecipients`);
    
    if (optionType === 'single') {
        singleSection.style.display = 'block';
        multipleSection.style.display = 'none';
    } else {
        singleSection.style.display = 'none';
        multipleSection.style.display = 'block';
    }
}

// Switch between manual entry and CSV upload for recipients
function switchRecipientsMethod(tabName, method) {
    const manualEntry = document.getElementById(`${tabName}ManualEntry`);
    const csvUpload = document.getElementById(`${tabName}CsvUpload`);
    
    if (method === 'manual') {
        manualEntry.style.display = 'block';
        csvUpload.style.display = 'none';
    } else {
        manualEntry.style.display = 'none';
        csvUpload.style.display = 'block';
    }
}

// Utility functions
function showStatus(elementId, message, type = 'info') {
    const statusElement = document.getElementById(elementId);
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

function validateMobile(mobile) {
    // Remove spaces and special characters
    const cleanMobile = mobile.replace(/[\s\-\+\(\)]/g, '');
    // Check if it's 7-15 digits (international format without + sign)
    const pattern = /^\d{7,15}$/;
    return pattern.test(cleanMobile);
}

function setButtonLoading(buttonId, isLoading, originalText) {
    const button = document.getElementById(buttonId);
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="icon">⏳</span>Sending...';
    } else {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

function generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return timestamp + randomStr;
}

// Handle CSV file upload
function handleCsvUpload(event, tabName) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    const statusElement = document.getElementById(`${tabName}Status`);
    
    reader.onload = function(e) {
        try {
            const csvData = parseCsv(e.target.result);
            
            // Validate CSV structure
            if (csvData.length === 0) {
                showStatus(`${tabName}Status`, '❌ CSV file is empty', 'error');
                return;
            }
            
            const headers = csvData[0];
            const rows = csvData.slice(1).filter(row => row.some(cell => cell.trim() !== ''));
            
            // Check if number column exists
            const numberColumnIndex = headers.findIndex(header => 
                header.toLowerCase().includes('number') || 
                header.toLowerCase().includes('phone') || 
                header.toLowerCase().includes('mobile') || 
                header.toLowerCase().includes('contact')
            );
            
            if (numberColumnIndex === -1) {
                showStatus(`${tabName}Status`, '❌ CSV must contain a column named "number", "phone", "mobile", or "contact"', 'error');
                return;
            }
            
            // Validate phone numbers and collect recipients
            const recipients = [];
            const invalidNumbers = [];
            
            rows.forEach((row, index) => {
                if (row.length <= numberColumnIndex) return; // Skip rows that don't have enough columns
                
                const phoneNumber = row[numberColumnIndex].trim();
                if (!phoneNumber) return; // Skip empty phone numbers
                
                if (validateMobile(phoneNumber)) {
                    // Create recipient object with all columns as potential variables
                    const recipient = {
                        number: phoneNumber
                    };
                    
                    // Add all other columns as variables
                    headers.forEach((header, idx) => {
                        if (idx !== numberColumnIndex && header.trim()) {
                            recipient[header.trim().toLowerCase()] = row[idx] || '';
                        }
                    });
                    
                    recipients.push(recipient);
                } else {
                    invalidNumbers.push({
                        row: index + 2, // +2 because 1-indexed and we skipped header
                        number: phoneNumber
                    });
                }
            });
            
            // Show validation results
            if (invalidNumbers.length > 0) {
                const errorMessage = `❌ Found ${invalidNumbers.length} invalid phone number(s):<br>` +
                    invalidNumbers.slice(0, 5).map(item => `Row ${item.row}: ${item.number}`).join('<br>') +
                    (invalidNumbers.length > 5 ? `<br>...and ${invalidNumbers.length - 5} more` : '');
                
                showStatus(`${tabName}Status`, errorMessage, 'error');
                
                // Still show preview if there are valid numbers
                if (recipients.length > 0) {
                    renderCsvPreview(tabName, headers, rows, recipients.length, invalidNumbers.length);
                }
                return;
            }
            
            if (recipients.length === 0) {
                showStatus(`${tabName}Status`, '❌ No valid phone numbers found in the CSV', 'error');
                return;
            }
            
            // Store recipients data
            window[`${tabName}Recipients`] = recipients;
            
            // Show success message
            showStatus(`${tabName}Status`, `✅ Successfully loaded ${recipients.length} recipient(s)`, 'success');
            
            // Show preview
            renderCsvPreview(tabName, headers, rows, recipients.length, 0);
            
            // Update recipients summary
            document.getElementById(`${tabName}RecipientsCount`).textContent = `${recipients.length} recipients loaded`;
            document.getElementById(`${tabName}RecipientsSummary`).style.display = 'block';
            
            // Clear any previous recipients
            const recipientsContainer = document.getElementById(`${tabName}RecipientsContainer`);
            recipientsContainer.innerHTML = '';
            
            // Add first 5 recipients to the summary
            recipients.slice(0, 5).forEach(recipient => {
                const recipientItem = document.createElement('div');
                recipientItem.className = 'recipient-item';
                
                const nameDisplay = recipient.name ? `${recipient.name} (${recipient.number})` : recipient.number;
                
                recipientItem.innerHTML = `
                    <div class="recipient-info">${nameDisplay}</div>
                `;
                
                recipientsContainer.appendChild(recipientItem);
            });
            
            // Add "and X more" if there are more than 5 recipients
            if (recipients.length > 5) {
                const moreItem = document.createElement('div');
                moreItem.className = 'recipient-item';
                moreItem.innerHTML = `<div class="recipient-info">...and ${recipients.length - 5} more</div>`;
                recipientsContainer.appendChild(moreItem);
            }
            
        } catch (error) {
            console.error('Error parsing CSV:', error);
            showStatus(`${tabName}Status`, `❌ Error parsing CSV: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        showStatus(`${tabName}Status`, '❌ Failed to read the file', 'error');
    };
    
    reader.readAsText(file);
}

// Parse CSV content
function parseCsv(csvContent) {
    const lines = csvContent.split(/\r\n|\n|\r/);
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle quoted fields with commas
        const row = [];
        let inQuotes = false;
        let currentField = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        
        // Add the last field
        row.push(currentField);
        
        // Remove quotes from fields
        const cleanRow = row.map(field => {
            if (field.startsWith('"') && field.endsWith('"')) {
                return field.substring(1, field.length - 1).replace(/""/g, '"');
            }
            return field;
        });
        
        result.push(cleanRow);
    }
    
    return result;
}

// Render CSV preview
function renderCsvPreview(tabName, headers, rows, validCount, invalidCount) {
    const previewElement = document.getElementById(`${tabName}CsvPreview`);
    const tableElement = document.getElementById(`${tabName}CsvTable`);
    const totalElement = document.getElementById(`${tabName}CsvTotal`);
    
    // Clear previous content
    tableElement.innerHTML = '';
    
    // Set total count
    totalElement.textContent = `(${validCount} valid, ${invalidCount} invalid, ${rows.length} total)`;
    
    // Create header row
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    tableElement.appendChild(headerRow);
    
    // Create data rows (show all rows)
    rows.forEach((row) => {
        const tr = document.createElement('tr');
        
        headers.forEach((_, index) => {
            const td = document.createElement('td');
            td.textContent = index < row.length ? row[index] : '';
            tr.appendChild(td);
        });
        
        tableElement.appendChild(tr);
    });
    
    // Show the preview
    previewElement.style.display = 'block';
}

// Get recipients based on current selection
function getRecipients(tabName) {
    const isMultiple = document.querySelector(`[data-tab="${tabName}"][data-option="multiple"]`).classList.contains('active');
    
    if (!isMultiple) {
        // Single recipient
        const mobile = document.getElementById(`${tabName}Mobile`).value.trim();
        if (!mobile) return [];
        if (!validateMobile(mobile)) {
            showStatus(`${tabName}Status`, 'Please enter a valid mobile number with country code (7-15 digits)', 'error');
            return [];
        }
        return [{ number: mobile, name: '' }];
    } else {
        // Multiple recipients
        const method = document.getElementById(`${tabName}RecipientsMethod`).value;
        
        if (method === 'manual') {
            const recipientsList = document.getElementById(`${tabName}RecipientsList`).value.trim();
            if (!recipientsList) return [];
            
            return recipientsList.split(',').map(item => ({
                number: item.trim(),
                name: ''
            })).filter(recipient => recipient.number && validateMobile(recipient.number));
        } else {
            // CSV method
            const recipients = window[`${tabName}Recipients`];
            
            if (!recipients || recipients.length === 0) {
                showStatus(`${tabName}Status`, '❌ Please upload a CSV file with valid recipients', 'error');
                return null;
            }
            
            return recipients;
        }
    }
}

// Text message functionality
async function sendTextMessage() {
    const recipients = getRecipients('text');
    const message = document.getElementById('textMessage').value.trim();
    
    if (recipients.length === 0) {
        showStatus('textStatus', 'Please enter recipient(s)', 'error');
        return;
    }
    
    if (!message) {
        showStatus('textStatus', 'Please enter a message', 'error');
        return;
    }
    
    if (recipients.length === 1) {
        await sendSingleMessage('text', recipients[0], message);
        } else {
        await sendBulkMessages('text', recipients, message);
    }
}

// URL message functionality
async function sendUrlMessage() {
    const recipients = getRecipients('url');
    const url = document.getElementById('mediaUrl').value.trim();
    const message = document.getElementById('urlMessage').value.trim();
    
    if (recipients.length === 0) {
        showStatus('urlStatus', 'Please enter recipient(s)', 'error');
        return;
    }
    
    if (!url) {
        showStatus('urlStatus', 'Please enter a URL', 'error');
        return;
    }
    
    try {
        new URL(url);
    } catch (e) {
        showStatus('urlStatus', 'Please enter a valid URL', 'error');
        return;
    }
    
    if (recipients.length === 1) {
        await sendSingleMessage('url', recipients[0], message, { url });
    } else {
        await sendBulkMessages('url', recipients, message, { url });
    }
}

// File message functionality
async function sendFileMessage() {
    const recipients = getRecipients('file');
    const message = document.getElementById('fileMessage').value.trim();
    
    if (recipients.length === 0) {
        showStatus('fileStatus', 'Please enter recipient(s)', 'error');
        return;
    }
    
    if (!selectedFile) {
        showStatus('fileStatus', 'Please select a file', 'error');
        return;
    }
    
    if (recipients.length === 1) {
        await sendSingleMessage('file', recipients[0], message, { file: selectedFile });
    } else {
        await sendBulkMessages('file', recipients, message, { file: selectedFile });
    }
    }
    
// Send single message
async function sendSingleMessage(type, recipient, message, options = {}) {
    const statusId = `${type}Status`;
    const buttonId = `${type}Btn`;
    const originalText = document.getElementById(buttonId).innerHTML;
    
    setButtonLoading(buttonId, true, originalText);
    showStatus(statusId, 'Sending message...', 'info');
    
    try {
        // Process message with template variables
        const processedMessage = processMessageWithVariables(message, recipient);
        
        let messageData = {
            action: 'contentjsToBackground',
            mobile: recipient.number,
            text: processedMessage
        };
        
        if (options.url) {
            messageData.url = options.url;
        } else if (options.file) {
            const base64Data = await fileToBase64(options.file);
            messageData.media = {
                mime: getMimeType(options.file),
                data: base64Data,
                filename: options.file.name,
                filesize: getDiskSizeFromBase64(base64Data)
            };
        }
        
        const response = await chrome.runtime.sendMessage(messageData);
        
        // Create history record
        const historyRecord = {
            id: generateUniqueId(),
            timestamp: Date.now(),
            messageType: 'single',
            mediaType: type,
            recipient: recipient,
            text: processedMessage,
            originalText: message,
            status: response.success ? 'success' : 'failed'
        };
        
        if (options.url) {
            historyRecord.mediaUrl = options.url;
            historyRecord.mediaFileName = options.url.split('/').pop();
        } else if (options.file) {
            historyRecord.mediaFileName = options.file.name;
        }
        
        saveMessageToHistory(historyRecord);
        
        if (response.success) {
            showStatus(statusId, '✅ Message sent successfully!', 'success');
            clearForm(type);
        } else {
            console.log(response.error);
            showStatus(statusId, `❌ Failed to send: ${response.response || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        showStatus(statusId, `❌ Error: ${error.message}`, 'error');
    } finally {
        setButtonLoading(buttonId, false, originalText);
    }
}

// Send bulk messages
async function sendBulkMessages(type, recipients, message, options = {}) {
    const statusId = `${type}Status`;
    const buttonId = `${type}Btn`;
    
    campaignInProgress = true;
    currentRecipientIndex = 0;
    currentCampaignId = generateUniqueId();
    
    // Prevent sleep if enabled
    if (appSettings.preventSleep) {
        preventSleep();
    }
    
    document.getElementById('bulkProgress').style.display = 'block';
    document.getElementById(buttonId).disabled = true;
    
    for (let i = 0; i < recipients.length; i++) {
        if (!campaignInProgress) break;
        
        currentRecipientIndex = i;
        updateProgressBar(i, recipients.length);
        
        const recipient = recipients[i];
        showStatus(statusId, `Sending to ${recipient.number}...`, 'info');
        
        try {
            // Process message with template variables
            const processedMessage = processMessageWithVariables(message, recipient);
            
            let messageData = {
                action: 'contentjsToBackground',
                mobile: recipient.number,
                text: processedMessage
            };
            
            if (options.url) {
                messageData.url = options.url;
            } else if (options.file) {
                const base64Data = await fileToBase64(options.file);
                messageData.media = {
                    mime: getMimeType(options.file),
                    data: base64Data,
                    filename: options.file.name,
                    filesize: getDiskSizeFromBase64(base64Data)
                };
            }
            
            const response = await chrome.runtime.sendMessage(messageData);
            
            // Create history record
        const historyRecord = {
            id: generateUniqueId(),
            timestamp: Date.now(),
                messageType: 'bulk',
                mediaType: type,
                recipient: recipient,
            text: processedMessage,
            originalText: message,
                status: response.success ? 'success' : 'failed'
        };
        
        saveMessageToHistory(historyRecord);
        
            if (!response.success) {
                showStatus(statusId, `❌ Failed to send to ${recipient.number}`, 'error');
            }
        } catch (error) {
            showStatus(statusId, `❌ Error sending to ${recipient.number}`, 'error');
        }
        
        // Check if should pause after batch
        if (shouldPauseAfterBatch(i + 1)) {
            const pauseDuration = getBatchPauseDuration();
            const pauseMinutes = appSettings.pauseMinutes;
            
            showStatus(statusId, `⏸️ Pausing for ${pauseMinutes} minutes after ${appSettings.batchSize} messages...`, 'info');
            document.getElementById('delayMessage').textContent = `Batch pause: waiting ${pauseMinutes} minutes after ${appSettings.batchSize} messages...`;
            document.getElementById('delayIndicator').style.display = 'block';
            
            // Show countdown timer
            const startTime = Date.now();
            const endTime = startTime + pauseDuration;
            const countdownInterval = setInterval(() => {
                const remaining = Math.ceil((endTime - Date.now()) / 1000);
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    return;
                }
                
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                document.getElementById('delayTimer').textContent = `${minutes}m ${seconds}s remaining`;
            }, 1000);
            
            await new Promise(resolve => setTimeout(resolve, pauseDuration));
            clearInterval(countdownInterval);
            document.getElementById('delayIndicator').style.display = 'none';
        }
        
        // Add delay between messages
        if (i < recipients.length - 1) {
            const delay = getSmartDelay();
            const delaySeconds = Math.ceil(delay / 1000);
            
            document.getElementById('delayMessage').textContent = appSettings.randomDelayEnabled ? 
                `Random delay: waiting before next message...` : 
                `Fixed delay: waiting before next message...`;
            document.getElementById('delayIndicator').style.display = 'block';
            
            // Show countdown timer
            const startTime = Date.now();
            const endTime = startTime + delay;
            const countdownInterval = setInterval(() => {
                const remaining = Math.ceil((endTime - Date.now()) / 1000);
                if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    return;
                }
                document.getElementById('delayTimer').textContent = `${remaining}s remaining`;
            }, 1000);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            clearInterval(countdownInterval);
            document.getElementById('delayIndicator').style.display = 'none';
        }
    }
    
    // Finish campaign
    campaignInProgress = false;
    document.getElementById('bulkProgress').style.display = 'none';
    document.getElementById(buttonId).disabled = false;
    showStatus(statusId, `✅ Campaign completed! Sent to ${recipients.length} recipients.`, 'success');
    clearForm(type);
    
    // Disable wake lock if it was enabled
    if (appSettings.preventSleep) {
        chrome.runtime.sendMessage({
            action: 'disableKeepAwake',
            campaignId: currentCampaignId
        });
    }
}

// Update progress bar
function updateProgressBar(current, total) {
    const progressPercent = Math.floor((current / total) * 100);
    document.getElementById('progressFill').style.width = `${progressPercent}%`;
    document.getElementById('progressCount').textContent = `${current}/${total} sent`;
    document.getElementById('progressPercent').textContent = `${progressPercent}%`;
}

// Clear form after successful send
function clearForm(type) {
    document.getElementById(`${type}Message`).value = '';
    
    if (type === 'text') {
        document.getElementById('textMobile').value = '';
        document.getElementById('textRecipientsList').value = '';
        document.getElementById('textCsvFile').value = '';
        document.getElementById('textCsvPreview').style.display = 'none';
        document.getElementById('textRecipientsSummary').style.display = 'none';
        window.textRecipients = null;
    } else if (type === 'url') {
        document.getElementById('urlMobile').value = '';
        document.getElementById('urlRecipientsList').value = '';
        document.getElementById('mediaUrl').value = '';
        document.getElementById('urlPreview').style.display = 'none';
        document.getElementById('urlCsvFile').value = '';
        document.getElementById('urlCsvPreview').style.display = 'none';
        document.getElementById('urlRecipientsSummary').style.display = 'none';
        window.urlRecipients = null;
    } else if (type === 'file') {
        document.getElementById('fileMobile').value = '';
        document.getElementById('fileRecipientsList').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('fileCsvFile').value = '';
        document.getElementById('fileCsvPreview').style.display = 'none';
        document.getElementById('fileRecipientsSummary').style.display = 'none';
        window.fileRecipients = null;
        selectedFile = null;
        document.getElementById('fileBtn').disabled = true;
    }
}

// File handling
function handleFileSelect() {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileBtn = document.getElementById('fileBtn');
    
    if (fileInput.files.length === 0) {
        fileInfo.style.display = 'none';
        fileBtn.disabled = true;
        selectedFile = null;
        return;
    }
    
    selectedFile = fileInput.files[0];
    const fileSize = (selectedFile.size / 1024 / 1024).toFixed(2);
    
    fileInfo.innerHTML = `
        <div style="font-weight: 500;">📄 ${selectedFile.name}</div>
        <div style="margin-top: 4px;">Size: ${fileSize} MB</div>
    `;
    fileInfo.style.display = 'block';
    fileBtn.disabled = false;
    
    if (selectedFile.size > 16 * 1024 * 1024) {
        showStatus('fileStatus', '⚠️ File size exceeds 16MB limit', 'error');
    } else {
        showStatus('fileStatus', '✅ File ready to send', 'success');
    }
}

// URL preview
function previewUrl() {
    const url = document.getElementById('mediaUrl').value.trim();
    const previewDiv = document.getElementById('urlPreview');
    
    if (!url) {
        previewDiv.style.display = 'none';
        return;
    }
    
    try {
        new URL(url);
    } catch (e) {
        previewDiv.innerHTML = '<span style="color: #cc0000;">Invalid URL format</span>';
        previewDiv.style.display = 'block';
        return;
    }
    
    const extension = url.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
    
    if (imageExtensions.includes(extension)) {
        previewDiv.innerHTML = `
            <div style="font-size: 12px; margin-bottom: 8px;">📷 Image Preview:</div>
            <img src="${url}" alt="Preview" style="max-width: 100%; max-height: 150px; border-radius: 4px;" 
                 onerror="this.style.display='none'; this.nextSibling.style.display='block';">
            <div style="display: none; color: #cc0000;">Failed to load image</div>
        `;
        previewDiv.style.display = 'block';
    } else if (videoExtensions.includes(extension)) {
        previewDiv.innerHTML = `
            <div style="font-size: 12px; margin-bottom: 8px;">🎥 Video Preview:</div>
            <video controls style="max-width: 100%; max-height: 150px; border-radius: 4px;">
                <source src="${url}" type="video/${extension}">
                Your browser does not support the video tag.
            </video>
        `;
        previewDiv.style.display = 'block';
    } else {
        previewDiv.innerHTML = `
            <div style="font-size: 12px;">📄 File: ${url.split('/').pop()}</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Type: ${extension.toUpperCase()}</div>
        `;
        previewDiv.style.display = 'block';
    }
}

// File utility functions
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

function getMimeType(file) {
    if (file.type) {
        return file.type;
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
}

function getDiskSizeFromBase64(base64Data) {
    const cleanedBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
    try {
        const binaryData = atob(cleanedBase64);
        return binaryData.length;
    } catch (error) {
        return Math.floor(base64Data.length * 0.75);
    }
}

// Template management
function loadSavedTemplates() {
    const saved = localStorage.getItem('whatsappTemplates');
    if (saved) {
        savedTemplates = JSON.parse(saved);
    } else {
        savedTemplates = [
            {
                id: 'default1',
                name: 'Meeting Reminder',
                content: 'Hi {{name}}, reminder about our meeting at {{time}}.'
            }
        ];
    }
}

// Global variable to track if we're editing a template
let editingTemplateId = null;

function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const content = document.getElementById('templateContent').value.trim();
    
    if (!name) {
        const statusElement = document.getElementById('templatesStatus');
        if (statusElement) {
            showStatus('templatesStatus', 'Please enter a template name', 'error');
        }
        return;
    }
    
    if (!content) {
        const statusElement = document.getElementById('templatesStatus');
        if (statusElement) {
            showStatus('templatesStatus', 'Please enter template content', 'error');
        }
        return;
    }
    
    // Check if we're editing an existing template
    if (editingTemplateId) {
        // Find the template
        const templateIndex = savedTemplates.findIndex(t => t.id === editingTemplateId);
        if (templateIndex !== -1) {
            // Update the template
            savedTemplates[templateIndex].name = name;
            savedTemplates[templateIndex].content = content;
            
            // Reset editing state
            editingTemplateId = null;
            
            // Update save button text
            document.getElementById('saveTemplateBtn').innerHTML = '<span class="icon">💾</span>Save Template';
            
            localStorage.setItem('whatsappTemplates', JSON.stringify(savedTemplates));
            renderSavedTemplates();
            populateTemplateDropdowns();
            
            showStatus('templatesStatus', '✅ Template updated successfully!', 'success');
        }
    } else {
        // Create a new template
        const template = {
            id: generateUniqueId(),
            name: name,
            content: content
        };
        
        savedTemplates.push(template);
        localStorage.setItem('whatsappTemplates', JSON.stringify(savedTemplates));
        
        showStatus('templatesStatus', '✅ Template saved successfully!', 'success');
    }
    
    // Clear form
    document.getElementById('templateName').value = '';
    document.getElementById('templateContent').value = '';
    
    renderSavedTemplates();
    populateTemplateDropdowns(); // Refresh dropdowns
}

function editTemplate(templateId) {
    const template = savedTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    // Set form values
    document.getElementById('templateName').value = template.name;
    document.getElementById('templateContent').value = template.content;
    
    // Set editing state
    editingTemplateId = templateId;
    
    // Change save button text
    document.getElementById('saveTemplateBtn').innerHTML = '<span class="icon">💾</span>Update Template';
    
    // Scroll to the form and focus on the name field
    document.getElementById('templateName').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('templateName').focus();
    
    // Switch to templates tab if not already there
    switchTab('templates');
    
    showStatus('templatesStatus', 'Editing template. Make your changes and click Update.', 'info');
}

function renderSavedTemplates() {
    const container = document.getElementById('savedTemplatesList');
    
    if (savedTemplates.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No templates saved yet</div>';
        return;
    }
    
    container.innerHTML = savedTemplates.map(template => `
        <div class="template-item">
            <div class="template-content">
                <div class="template-name">${template.name}</div>
                <div class="template-text">${template.content}</div>
            </div>
            <div class="template-actions">
                <button class="template-action-btn use-template-btn" data-template-id="${template.id}" title="Use Template">📋</button>
                <button class="template-action-btn edit-template-btn" data-template-id="${template.id}" title="Edit Template">✏️</button>
                <button class="template-action-btn delete-template-btn" data-template-id="${template.id}" title="Delete Template">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners for the newly created buttons
    container.querySelectorAll('.use-template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            useTemplate(this.getAttribute('data-template-id'));
        });
    });
    
    container.querySelectorAll('.edit-template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            editTemplate(this.getAttribute('data-template-id'));
        });
    });
    
    container.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteTemplate(this.getAttribute('data-template-id'));
        });
    });
}

function deleteTemplate(templateId) {
    // Find template name for the confirmation message
    const template = savedTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    // Create a confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.top = '50%';
    confirmDialog.style.left = '50%';
    confirmDialog.style.transform = 'translate(-50%, -50%)';
    confirmDialog.style.backgroundColor = 'white';
    confirmDialog.style.padding = '20px';
    confirmDialog.style.borderRadius = '8px';
    confirmDialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    confirmDialog.style.zIndex = '1000';
    confirmDialog.style.minWidth = '300px';
    
    confirmDialog.innerHTML = `
        <h3 style="margin-top: 0; color: #dc2626;">Delete Template</h3>
        <p>Are you sure you want to delete the template "${template.name}"?</p>
        <p style="color: #64748b; font-size: 13px;">This action cannot be undone.</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button id="cancelDeleteTemplate" style="padding: 8px 12px;">Cancel</button>
            <button id="confirmDeleteTemplate" style="padding: 8px 12px; background: #dc2626; color: white; border: none; border-radius: 4px;">Delete</button>
        </div>
    `;
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.right = '0';
    backdrop.style.bottom = '0';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '999';
    
    document.body.appendChild(backdrop);
    document.body.appendChild(confirmDialog);
    
    // Handle button clicks
    document.getElementById('cancelDeleteTemplate').addEventListener('click', function() {
        document.body.removeChild(confirmDialog);
        document.body.removeChild(backdrop);
    });
    
    document.getElementById('confirmDeleteTemplate').addEventListener('click', function() {
        savedTemplates = savedTemplates.filter(t => t.id !== templateId);
        localStorage.setItem('whatsappTemplates', JSON.stringify(savedTemplates));
        renderSavedTemplates();
        populateTemplateDropdowns(); // Refresh dropdowns
        
        document.body.removeChild(confirmDialog);
        document.body.removeChild(backdrop);
    });
}

function applyTemplateFromDropdown(targetTab, templateId) {
    if (!templateId) return; // No template selected
    
    const template = savedTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    const messageField = document.getElementById(`${targetTab}Message`);
    if (messageField) {
        messageField.value = template.content;
        messageField.focus();
        showStatus(`${targetTab}Status`, `✅ Template "${template.name}" applied!`, 'success');
        
        // Reset dropdown to default option
        const dropdown = document.getElementById(`${targetTab}TemplateSelect`);
        if (dropdown) {
            dropdown.value = '';
        }
    }
}

function populateTemplateDropdowns() {
    const dropdowns = ['textTemplateSelect', 'urlTemplateSelect', 'fileTemplateSelect'];
    
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            // Clear existing options except the first one
            while (dropdown.children.length > 1) {
                dropdown.removeChild(dropdown.lastChild);
            }
            
            // Add template options
            savedTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                dropdown.appendChild(option);
            });
        }
    });
}

function useTemplate(templateId) {
    const template = savedTemplates.find(t => t.id === templateId);
    if (template) {
        // Get the currently active tab
        const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
        if (['text', 'url', 'file'].includes(activeTab)) {
            document.getElementById(`${activeTab}Message`).value = template.content;
            switchTab(activeTab); // Switch to that tab
        }
    }
}

function insertVariable(variable) {
    const activeTab = document.querySelector('.tab.active').getAttribute('data-tab');
    let targetField = null;
    
    if (activeTab === 'templates') {
        targetField = document.getElementById('templateContent');
    } else if (['text', 'url', 'file'].includes(activeTab)) {
        targetField = document.getElementById(`${activeTab}Message`);
        }
    
    if (targetField) {
        const cursorPos = targetField.selectionStart || 0;
        const textBefore = targetField.value.substring(0, cursorPos);
        const textAfter = targetField.value.substring(cursorPos);
        
        targetField.value = textBefore + variable + textAfter;
        targetField.focus();
        
        // Set cursor position after the inserted variable
        const newCursorPos = cursorPos + variable.length;
        targetField.setSelectionRange(newCursorPos, newCursorPos);
    }
}

// Template export/import functions
function exportTemplatesToFile() {
    if (savedTemplates.length === 0) {
        showStatus('templatesStatus', 'No templates to export', 'error');
        return;
    }
    
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        templates: savedTemplates
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `whatsapp_templates_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('templatesStatus', `✅ ${savedTemplates.length} templates exported successfully!`, 'success');
}

function importTemplatesFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            // Validate import data structure
            if (!importData.templates || !Array.isArray(importData.templates)) {
                throw new Error('Invalid file format');
            }
            
            let importedCount = 0;
            let skippedCount = 0;
            
            importData.templates.forEach(template => {
                // Validate template structure
                if (template.name && template.content) {
                    // Check if template with same name already exists
                    const existingTemplate = savedTemplates.find(t => t.name === template.name);
                    
                    if (existingTemplate) {
                        // Ask user if they want to overwrite
                        if (confirm(`Template "${template.name}" already exists. Overwrite?`)) {
                            existingTemplate.content = template.content;
                            importedCount++;
        } else {
                            skippedCount++;
                        }
                    } else {
                        // Add new template
                        savedTemplates.push({
            id: generateUniqueId(),
                            name: template.name,
                            content: template.content
                        });
                        importedCount++;
                    }
                } else {
                    skippedCount++;
                }
            });
            
            if (importedCount > 0) {
                localStorage.setItem('whatsappTemplates', JSON.stringify(savedTemplates));
                renderSavedTemplates();
                populateTemplateDropdowns();
            }
            
            let message = `✅ Import completed! ${importedCount} templates imported`;
            if (skippedCount > 0) {
                message += `, ${skippedCount} skipped`;
            }
            showStatus('templatesStatus', message, 'success');
            
        } catch (error) {
            showStatus('templatesStatus', '❌ Invalid file format or corrupted data', 'error');
        }
    };
    
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
}

// History management
function loadMessageHistory() {
    const saved = localStorage.getItem('whatsappMessageHistory');
    if (saved) {
        messageHistory = JSON.parse(saved);
    } else {
        messageHistory = [];
    }
}

function saveMessageToHistory(message) {
    loadMessageHistory();
    messageHistory.unshift(message);
    localStorage.setItem('whatsappMessageHistory', JSON.stringify(messageHistory));
    
    if (document.getElementById('history-tab').classList.contains('active')) {
        renderHistoryList();
    }
}

function clearMessageHistory() {
    // Create a confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.top = '50%';
    confirmDialog.style.left = '50%';
    confirmDialog.style.transform = 'translate(-50%, -50%)';
    confirmDialog.style.backgroundColor = 'white';
    confirmDialog.style.padding = '20px';
    confirmDialog.style.borderRadius = '8px';
    confirmDialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    confirmDialog.style.zIndex = '1000';
    confirmDialog.style.minWidth = '300px';
    
    confirmDialog.innerHTML = `
        <h3 style="margin-top: 0; color: #dc2626;">Clear History</h3>
        <p>Are you sure you want to clear all message history?</p>
        <p style="color: #64748b; font-size: 13px;">This action cannot be undone.</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button id="cancelClearHistory" style="padding: 8px 12px;">Cancel</button>
            <button id="confirmClearHistory" style="padding: 8px 12px; background: #dc2626; color: white; border: none; border-radius: 4px;">Clear History</button>
        </div>
    `;
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.right = '0';
    backdrop.style.bottom = '0';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '999';
    
    document.body.appendChild(backdrop);
    document.body.appendChild(confirmDialog);
    
    // Handle button clicks
    document.getElementById('cancelClearHistory').addEventListener('click', function() {
        document.body.removeChild(confirmDialog);
        document.body.removeChild(backdrop);
    });
    
    document.getElementById('confirmClearHistory').addEventListener('click', function() {
        messageHistory = [];
        localStorage.removeItem('whatsappMessageHistory');
        renderHistoryList();
        
        document.body.removeChild(confirmDialog);
        document.body.removeChild(backdrop);
    });
}

function filterHistory() {
    const typeFilter = historyFilters.type;
    const statusFilter = historyFilters.status;
    const searchTerm = historyFilters.search.toLowerCase();
    
    return messageHistory.filter(message => {
        if (typeFilter === 'single' && message.messageType !== 'single') return false;
        if (typeFilter === 'bulk' && message.messageType !== 'bulk') return false;
        if (statusFilter !== 'all' && message.status !== statusFilter) return false;
        
        if (searchTerm) {
            const searchableText = [
                    message.recipient?.number || '',
                    message.recipient?.name || '',
                message.text || ''
                ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        return true;
    });
}

function renderHistoryList() {
    const historyList = document.getElementById('historyList');
    const filteredHistory = filterHistory();
    
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / historyItemsPerPage));
    
    // Ensure current page is valid
    if (currentHistoryPage > totalPages) {
        currentHistoryPage = totalPages;
    }
    
    const startIndex = (currentHistoryPage - 1) * historyItemsPerPage;
    const endIndex = startIndex + historyItemsPerPage;
    const currentPageItems = filteredHistory.slice(startIndex, endIndex);
    
    document.getElementById('prevPageBtn').disabled = currentHistoryPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentHistoryPage >= totalPages;
    document.getElementById('paginationInfo').textContent = `Page ${currentHistoryPage} of ${totalPages}`;
    
    if (currentPageItems.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No message history found</div>';
        return;
    }
    
        historyList.innerHTML = currentPageItems.map(message => {
            const date = new Date(message.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            
            let icon = '💬';
            if (message.mediaType === 'url') icon = '🔗';
            else if (message.mediaType === 'file') icon = '📎';
            
            const statusClass = message.status === 'success' ? 'success' : 'error';
            
            // Build media info if available
            let mediaInfo = '';
            if (message.mediaType === 'url' && message.mediaUrl) {
                mediaInfo = `<div class="message-media-info">
                    <span class="icon">🔗</span>${truncateText(message.mediaUrl, 30)}
                </div>`;
            } else if (message.mediaType === 'file' && message.mediaFileName) {
                mediaInfo = `<div class="message-media-info">
                    <span class="icon">📎</span>${truncateText(message.mediaFileName, 30)}
                </div>`;
            }
            
        return `
            <div class="history-item">
                    <span class="icon">${icon}</span>
                <div class="message-details">
                    <div class="message-text">${truncateText(message.text, 50)}</div>
                    ${mediaInfo}
                    <div class="message-meta">
                        <span class="icon">👤</span>${message.recipient.name || message.recipient.number}
                        <span class="icon">🕒</span>${formattedDate}
                    </div>
                </div>
                    <span class="message-status ${statusClass}">${message.status === 'success' ? 'Sent' : 'Failed'}</span>
                <span class="message-type">${message.messageType}</span>
                <button class="action-button duplicate-message-btn" data-message-id="${message.id}" title="Duplicate">📋</button>
                </div>
            `;
    }).join('');
    
    // Add event listeners for duplicate buttons
    historyList.querySelectorAll('.duplicate-message-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            duplicateMessage(this.getAttribute('data-message-id'));
        });
    });
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function duplicateMessage(messageId) {
    const message = messageHistory.find(msg => msg.id === messageId);
    if (!message) return;
    
    const tabName = message.mediaType || 'text';
    switchTab(tabName);
        
    // Set to single recipient mode
    switchSendOption(tabName, 'single');
    
    // Fill in the data
    document.getElementById(`${tabName}Mobile`).value = message.recipient.number || '';
    document.getElementById(`${tabName}Message`).value = message.text || '';
        
    if (tabName === 'url' && message.mediaUrl) {
        document.getElementById('mediaUrl').value = message.mediaUrl;
        previewUrl();
    }
    
    // Note: For file type, we can't duplicate the actual file as we don't store the file data
    // in the history, only the filename
    if (tabName === 'file' && message.mediaFileName) {
        showStatus(`${tabName}Status`, `⚠️ Please re-upload the file "${message.mediaFileName}" as file data is not stored in history.`, 'info');
    } else {
        showStatus(`${tabName}Status`, '✅ Message duplicated. You can now edit and send it again.', 'success');
    }
}

function changePage(direction) {
    const filteredHistory = filterHistory();
    const totalPages = Math.max(1, Math.ceil(filteredHistory.length / historyItemsPerPage));
    
    const newPage = currentHistoryPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentHistoryPage = newPage;
        renderHistoryList();
    }
}

function exportHistoryToCsv() {
    if (messageHistory.length === 0) {
        alert('No message history to export.');
        return;
    }
    
    // Create a dialog with radio buttons for format selection
    const formatDialog = document.createElement('div');
    formatDialog.style.position = 'fixed';
    formatDialog.style.top = '50%';
    formatDialog.style.left = '50%';
    formatDialog.style.transform = 'translate(-50%, -50%)';
    formatDialog.style.backgroundColor = 'white';
    formatDialog.style.padding = '20px';
    formatDialog.style.borderRadius = '8px';
    formatDialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    formatDialog.style.zIndex = '1000';
    formatDialog.style.minWidth = '300px';
    
    formatDialog.innerHTML = `
        <h3 style="margin-top: 0;">Export Format</h3>
        <div style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; margin-bottom: 10px;">
                <input type="radio" name="exportFormat" value="json" checked style="margin-right: 8px;"> 
                <div>
                    <strong>JSON</strong> (for importing back into the app)
                </div>
            </label>
            <label style="display: flex; align-items: center;">
                <input type="radio" name="exportFormat" value="csv" style="margin-right: 8px;"> 
                <div>
                    <strong>CSV</strong> (for spreadsheets)
                </div>
            </label>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="cancelExport" style="padding: 8px 12px;">Cancel</button>
            <button id="confirmExport" style="padding: 8px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px;">Export</button>
        </div>
    `;
    
    document.body.appendChild(formatDialog);
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.right = '0';
    backdrop.style.bottom = '0';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '999';
    document.body.appendChild(backdrop);
    
    // Handle button clicks
    document.getElementById('cancelExport').addEventListener('click', function() {
        document.body.removeChild(formatDialog);
        document.body.removeChild(backdrop);
    });
    
    document.getElementById('confirmExport').addEventListener('click', function() {
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        document.body.removeChild(formatDialog);
        document.body.removeChild(backdrop);
        
        if (format === 'json') {
            exportHistoryToJson();
        } else {
            exportHistoryToCsvFormat();
        }
    });
}

function exportHistoryToJson() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        history: messageHistory
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `whatsapp_history_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportHistoryToCsvFormat() {
    let csvContent = 'timestamp,type,recipient,message,status,mediaType,mediaUrl,mediaFileName\n';
    
    messageHistory.forEach(message => {
        const row = [
            new Date(message.timestamp).toISOString(),
            message.messageType,
            message.recipient.number,
            (message.text || '').replace(/,/g, ' ').replace(/\n/g, ' '),
            message.status,
            message.mediaType || '',
            message.mediaUrl || '',
            message.mediaFileName || ''
        ];
        
        csvContent += row.map(field => `"${field}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `whatsapp_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importHistoryFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.json')) {
        alert('❌ Please select a JSON file (.json extension)');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            // Validate import data structure
            if (!importData.history || !Array.isArray(importData.history)) {
                throw new Error('Invalid file format');
            }
            
            let importedCount = 0;
            let skippedCount = 0;
            
            importData.history.forEach(historyItem => {
                // Validate history item structure
                if (historyItem.id && historyItem.timestamp && historyItem.recipient) {
                    // Check if history item with same ID already exists
                    const existingItem = messageHistory.find(h => h.id === historyItem.id);
                    
                    if (!existingItem) {
                        messageHistory.unshift(historyItem);
                        importedCount++;
                    } else {
                        skippedCount++;
                    }
                } else {
                    skippedCount++;
                }
            });
            
            if (importedCount > 0) {
                localStorage.setItem('whatsappMessageHistory', JSON.stringify(messageHistory));
                currentHistoryPage = 1; // Reset to first page
                renderHistoryList();
            }
            
            // Create a status dialog
            const statusDialog = document.createElement('div');
            statusDialog.style.position = 'fixed';
            statusDialog.style.top = '50%';
            statusDialog.style.left = '50%';
            statusDialog.style.transform = 'translate(-50%, -50%)';
            statusDialog.style.backgroundColor = 'white';
            statusDialog.style.padding = '20px';
            statusDialog.style.borderRadius = '8px';
            statusDialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            statusDialog.style.zIndex = '1000';
            statusDialog.style.minWidth = '300px';
            
            let statusMessage = `<h3 style="margin-top: 0;">Import Complete</h3>
                <p>${importedCount} history items imported successfully.</p>`;
            
            if (skippedCount > 0) {
                statusMessage += `<p>${skippedCount} items skipped (duplicates or invalid format).</p>`;
            }
            
            statusDialog.innerHTML = `
                ${statusMessage}
                <div style="display: flex; justify-content: flex-end;">
                    <button id="closeImportStatus" style="padding: 8px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px;">OK</button>
                </div>
            `;
            
            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.style.position = 'fixed';
            backdrop.style.top = '0';
            backdrop.style.left = '0';
            backdrop.style.right = '0';
            backdrop.style.bottom = '0';
            backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
            backdrop.style.zIndex = '999';
            
            document.body.appendChild(backdrop);
            document.body.appendChild(statusDialog);
            
            document.getElementById('closeImportStatus').addEventListener('click', function() {
                document.body.removeChild(statusDialog);
                document.body.removeChild(backdrop);
            });
            
        } catch (error) {
            alert('❌ Invalid file format or corrupted data');
        }
    };
    
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
}

// Settings management
function loadSettings() {
    const saved = localStorage.getItem('whatsappSettings');
    if (saved) {
        appSettings = { ...appSettings, ...JSON.parse(saved) };
    }
    updateSettingsUI();
}

function saveSettings() {
    // Get values from UI
    appSettings.randomDelayEnabled = document.getElementById('randomDelayEnabled').checked;
    appSettings.maxDelaySeconds = parseInt(document.getElementById('maxDelaySeconds').value) || 30;
    appSettings.pauseAfterBatch = document.getElementById('pauseAfterBatch').checked;
    appSettings.pauseMinutes = parseInt(document.getElementById('pauseMinutes').value) || 5;
    appSettings.batchSize = parseInt(document.getElementById('batchSize').value) || 40;
    appSettings.preventSleep = document.getElementById('preventSleep').checked;
    
    // Validate settings
    if (appSettings.maxDelaySeconds < 5) appSettings.maxDelaySeconds = 5;
    if (appSettings.maxDelaySeconds > 600) appSettings.maxDelaySeconds = 600;
    if (appSettings.pauseMinutes < 1) appSettings.pauseMinutes = 1;
    if (appSettings.pauseMinutes > 60) appSettings.pauseMinutes = 60;
    if (appSettings.batchSize < 10) appSettings.batchSize = 10;
    if (appSettings.batchSize > 100) appSettings.batchSize = 100;
    
    localStorage.setItem('whatsappSettings', JSON.stringify(appSettings));
    updateSettingsUI();
    showStatus('settingsStatus', '✅ Settings saved successfully!', 'success');
}

function resetSettings() {
    // Create a confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.style.position = 'fixed';
    confirmDialog.style.top = '50%';
    confirmDialog.style.left = '50%';
    confirmDialog.style.transform = 'translate(-50%, -50%)';
    confirmDialog.style.backgroundColor = 'white';
    confirmDialog.style.padding = '20px';
    confirmDialog.style.borderRadius = '8px';
    confirmDialog.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    confirmDialog.style.zIndex = '1000';
    confirmDialog.style.minWidth = '300px';
    
    confirmDialog.innerHTML = `
        <h3 style="margin-top: 0; color: #dc2626;">Reset Settings</h3>
        <p>Are you sure you want to reset all settings to default?</p>
        <p style="color: #64748b; font-size: 13px;">This will restore all default values.</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button id="cancelResetSettings" style="padding: 8px 12px;">Cancel</button>
            <button id="confirmResetSettings" style="padding: 8px 12px; background: #dc2626; color: white; border: none; border-radius: 4px;">Reset</button>
        </div>
    `;
    
    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.top = '0';
    backdrop.style.left = '0';
    backdrop.style.right = '0';
    backdrop.style.bottom = '0';
    backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
    backdrop.style.zIndex = '999';
    
    document.body.appendChild(backdrop);
    document.body.appendChild(confirmDialog);
    
    // Handle button clicks
    document.getElementById('cancelResetSettings').addEventListener('click', function() {
        document.body.removeChild(confirmDialog);
        document.body.removeChild(backdrop);
    });
    
    document.getElementById('confirmResetSettings').addEventListener('click', function() {
        appSettings = {
            randomDelayEnabled: true,
            maxDelaySeconds: 300, // 5 minutes max
            pauseAfterBatch: false,
            pauseMinutes: 5,
            batchSize: 40,
            preventSleep: false
        };
        localStorage.removeItem('whatsappSettings');
        updateSettingsUI();
        showStatus('settingsStatus', '✅ Settings reset to default!', 'success');
        
        document.body.removeChild(confirmDialog);
        document.body.removeChild(backdrop);
    });
}

function updateSettingsUI() {
    const randomDelayEnabled = document.getElementById('randomDelayEnabled');
    const maxDelaySeconds = document.getElementById('maxDelaySeconds');
    const pauseAfterBatch = document.getElementById('pauseAfterBatch');
    const pauseMinutes = document.getElementById('pauseMinutes');
    const batchSize = document.getElementById('batchSize');
    const preventSleep = document.getElementById('preventSleep');
    
    if (randomDelayEnabled) randomDelayEnabled.checked = appSettings.randomDelayEnabled;
    if (maxDelaySeconds) maxDelaySeconds.value = appSettings.maxDelaySeconds;
    if (pauseAfterBatch) pauseAfterBatch.checked = appSettings.pauseAfterBatch;
    if (pauseMinutes) pauseMinutes.value = appSettings.pauseMinutes;
    if (batchSize) batchSize.value = appSettings.batchSize;
    if (preventSleep) preventSleep.checked = appSettings.preventSleep;
}

function toggleSettings() {
    const settingsTab = document.getElementById('settings-tab');
    const settingsIcon = document.getElementById('settingsIcon');
    
    if (settingsTab.classList.contains('active')) {
        // Currently showing settings, hide them
        hideSettings();
    } else {
        // Currently showing main interface, show settings
        showSettings();
    }
}

function showSettings() {
    const settingsIcon = document.getElementById('settingsIcon');
    
    // Hide all tabs and show settings
    document.querySelectorAll('.tab').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show settings tab
    document.getElementById('settings-tab').classList.add('active');
    updateSettingsUI();
    
    // Change icon to cross
    settingsIcon.textContent = '✕';
    document.getElementById('settingsBtn').title = 'Close Settings';
}

function hideSettings() {
    const settingsIcon = document.getElementById('settingsIcon');
    
    // Show all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.getAttribute('data-tab') !== 'settings') {
            tab.style.display = 'block';
        }
    });
    
    // Hide settings tab
    document.getElementById('settings-tab').classList.remove('active');
    
    // Show default tab (text)
    document.getElementById('text-tab').classList.add('active');
    document.querySelector('[data-tab="text"]').classList.add('active');
    
    // Change icon back to settings
    settingsIcon.textContent = '⚙️';
    document.getElementById('settingsBtn').title = 'Settings';
}

// Get smart delay based on settings
function getSmartDelay() {
    if (!appSettings.randomDelayEnabled) {
        return 5000; // Default 5 seconds if random delay is disabled
    }
    
    const minDelay = 5000; // Minimum 5 seconds
    const maxDelay = appSettings.maxDelaySeconds * 1000; // Convert to milliseconds
    
    // Ensure maxDelay is at least minDelay
    const effectiveMaxDelay = Math.max(maxDelay, minDelay);
    
    // Generate a random delay between minDelay and effectiveMaxDelay
    return Math.floor(Math.random() * (effectiveMaxDelay - minDelay + 1)) + minDelay;
}

// Check if should pause after batch
function shouldPauseAfterBatch(messageCount) {
    return appSettings.pauseAfterBatch && messageCount > 0 && messageCount % appSettings.batchSize === 0;
}

// Get batch pause duration
function getBatchPauseDuration() {
    return appSettings.pauseMinutes * 60 * 1000; // Convert to milliseconds
}

// Prevent sleep functionality
function preventSleep() {
    if (appSettings.preventSleep) {
        // Send message to background script to keep the extension alive
        chrome.runtime.sendMessage({
            action: 'enableKeepAwake',
            campaignId: currentCampaignId
        });
    }
}

// Process message with template variables
function processMessageWithVariables(message, recipient) {
    if (!message || !recipient) return message;
    
    let processedMessage = message;
    
    // Replace standard variables
    processedMessage = processedMessage.replace(/{{number}}/gi, recipient.number || '');
    processedMessage = processedMessage.replace(/{{time}}/gi, new Date().toLocaleTimeString());
    
    // Replace custom variables from CSV
    for (const [key, value] of Object.entries(recipient)) {
        if (key !== 'number') {
            const regex = new RegExp(`{{${key}}}`, 'gi');
            processedMessage = processedMessage.replace(regex, value || '');
        }
    }
    
    return processedMessage;
}

// Load version info from manifest
function loadVersionInfo() {
    const versionElement = document.getElementById('extensionVersion');
    const headerVersionElement = document.getElementById('headerVersion');
    
    if (chrome.runtime && chrome.runtime.getManifest) {
        try {
            const manifest = chrome.runtime.getManifest();
            const version = manifest.version;
            
            if (versionElement) {
                versionElement.textContent = version;
            }
            
            if (headerVersionElement) {
                headerVersionElement.textContent = version;
            }
        } catch (error) {
            // Fallback to hardcoded version if manifest is not accessible
            const fallbackVersion = '0.0.0';
            
            if (versionElement) {
                versionElement.textContent = fallbackVersion;
            }
            
            if (headerVersionElement) {
                headerVersionElement.textContent = fallbackVersion;
            }
        }
    }
}