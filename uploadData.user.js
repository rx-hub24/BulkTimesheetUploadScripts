// ==UserScript==
// @name         Run script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a button at the top of people hub to redirect to timesheeting page.
// @author       Emma Nipperess
// @match        https://elmo.yourpayroll.com.au/Employee/*
// @require      https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js

// @grant        none
// ==/UserScript==

(function() {
   function generateTimesheet(employeeId, startTime, endTime, breaks = []) {
       return {
           "ReadOnly": false,
           "IsPublicHoliday": false,
           "LocationName": null,
           "DimensionValueIds": [],
           "Id": 0,
           "Status": 0,
           "Start": startTime,
           "End": endTime,
           "EmployeeId": employeeId,
           "Breaks": breaks.map(b => ({
               "Start": b.start,
               "End": b.end,
               "IsPaidBreak": b.isPaid || false
           })),
           "IsNew": true,
           "Units": null,
           "ClassificationId": null,
           "WorkTypeId": null,
           "WorkTypeName": null,
           "LocationId": null,
           "Comments": null,
           "ExternalReferenceId": null,
           "LeaveRequestId": null,
           "IsLocked": false,
           "Attachment": {
               "Id": null,
               "Url": null,
               "FriendlyName": null,
               "DateCreated": null,
               "IsInfected": false
           },
           "ShiftConditionIds": [],
           "ClassificationName": null,
           "Source": 0
       };
   }


    async function performBulkUpload(employeeId, payload) {
        
        const headers = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',

        };

        // URLs and Payloads
        const uploadUrl = `https://elmo.yourpayroll.com.au/Employee/${employeeId}/TimesheetGrid/SaveTimesheets`;


        // Send POST request using Fetch API
        let response = await fetch(uploadUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: headers,
            credentials: 'include', // This will ensure cookies are sent with the request
            //mode: 'no-cors'  // setting mode to no-cors
        });

        // Check if the upload was successful
        if (response.status === 200) {
            console.log("Bulk upload successful.");
        } else {
            const text = await response.text();
            console.log(`Failed to upload. Status code: ${response.status} ${text}`);
        }
    }


    function formatDate(date) {
        const day = date.getDate();
        const month = date.getMonth() + 1; // Months are 0-indexed
        const year = date.getFullYear();
        return new Date(`${year}-${day}-${month}`);
    }

    function excelDateToJSDate(serial) {
        const utc_days = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;
        const newDate = new Date(utc_value * 1000);
        const month = newDate.getDate();
        return [formatDate(newDate), month];
    }

    function getEmployeeIdFromURL() {
        // Get the current URL from the browser's address bar
        const currentUrl = window.location.href;

        // Use a regular expression to find the digit(s) following "Employee/"
        const match = currentUrl.match(/Employee\/(\d+)/);

        // match[1] contains the first capturing group, which is the sequence of digits we're interested in
        // If a match is found, return it, otherwise return null or some default value
        return match ? match[1] : null;
    }

    function getEmployeeName() {
        // Use querySelector to find the span element by its data-bind attribute
        const spanElement = document.querySelector('span[data-bind="text: EmployeeName"]');

        // Check if the element exists to avoid errors
        if (spanElement) {
            // Return the text content of the span element, which is the employee name
            return spanElement.textContent; // or spanElement.innerText
        } else {
            // If the element is not found, return null or some placeholder text
            return null; // or "Employee name not found"
        }
    }

    function processCsvData(csvString, month) {
        const employee = getEmployeeName();
        const employeeId = getEmployeeIdFromURL();
        console.log("Processing csv data");
        var fields = csvString
        console.log(fields.length);


        // Number of fields per record
        const fieldsPerRecord = 8;
        const outputData = [];

        // Iterate through fields in steps of `fieldsPerRecord` to process each record
        for (let i = 0; i < fields.length; i += 1) {
            console.log(i);

            // Extract fields for the current record
            const entry = fields[i];
            console.log(entry);

            const name = entry["Created By"];
            console.log(name);
            if (name == employee) {
                const dateString = entry["Date"];
                console.log(dateString);
                const hours = entry["Hours"];
                console.log(hours);

                console.log("Date string");
                console.log(dateString);
                console.log(typeof dateString);

                var curMonth = null;

                if (Number.isInteger(dateString)) {
                    var returnVal = excelDateToJSDate(dateString);
                    var dateVal = returnVal[0];
                    curMonth = returnVal[1];

                } else {
                    var [day, mnth, year] = dateString.split('/');
                    curMonth = mnth;
                    console.log(curMonth);
                    dateVal = new Date(`${year}-${curMonth}-${day}`);
                }

                // Check if the month matches
                console.log(month)
                if (month == curMonth) {
                    console.log("month matches");
                    const ausStart = new Date(dateVal.setHours(9, 0, 0, 0));
                    // Calculate the local time zone offset and convert it to milliseconds
                    const timeZoneOffsetInMs = ausStart.getTimezoneOffset() * 60 * 1000;
                    // Adjust the date by the time zone offset to get the correct UTC time representing 9 AM local time
                    const startDateTime = new Date(dateVal.getTime() - timeZoneOffsetInMs);

                    var breakL = 0;
                    const breaks = [];
                    if (hours > 4) {
                        breakL = 0.5;
                        const breakStart = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000);
                        const breakEnd = new Date(breakStart.getTime() + 30 * 60 * 1000);
                        breaks.push({
                            start: breakStart.toISOString(),
                            end: breakEnd.toISOString(),
                            isPaid: false
                        });
                    }

                    const endDateTime = new Date(startDateTime.getTime() + (hours + breakL) * 60 * 60 * 1000);

                    const entry = {
                        employeeId: employeeId || "Unknown", // Use empMap to lookup employee ID
                        daysWorked: [{
                            startTime: startDateTime.toISOString(),
                            endTime: endDateTime.toISOString(),
                            breaks: breaks
                        }]
                    };

                    console.log(entry);

                    outputData.push(entry);
                }
            }
        }

        // Assuming we're logging the output data as a string for demonstration
        console.log(JSON.stringify(outputData, null, 4));
        return outputData
    }

    function getLastMonth() {
        let date = new Date(); // Gets the current date and time
        let lastMonth = new Date(date.setMonth(date.getMonth())); 

        console.log(lastMonth.getMonth());

        return lastMonth.getMonth();
    }

    function getCurrentMonth() {
        let date = new Date(); // Gets the current date and time
        let lastMonth = new Date(date.setMonth(date.getMonth()+1)); 

        console.log(lastMonth.getMonth());

        return lastMonth.getMonth();
    }


    async function uploadForMultiplePersonsAndDays(input, lastMonth) {
        var chosenMonth = null;
        if (lastMonth) {
            chosenMonth = getLastMonth();
        } else {
            chosenMonth = getCurrentMonth();
        }

        var data = processCsvData(input, chosenMonth)
        var numEntriesUploaded = 0;
        for (const entry of data) {
            const { employeeId, daysWorked } = entry;
            const timesheets = daysWorked.map(day => {
                const { startTime, endTime, breaks } = day;
                return generateTimesheet(employeeId, startTime, endTime, breaks);
            });

            const payload = {
                "timesheets": timesheets,
                "employeeId": employeeId,
                "approve": true,
                "allowNegativeLeaveBalances": false
            };

            console.log("performing the upload for employee", employeeId);
            await performBulkUpload(employeeId, payload);
            numEntriesUploaded += 1;
        }
        alert("upload finished: uploaded " + numEntriesUploaded + " time sheets");
        window.location.reload();
    }

    function createUploadButton() {
        // Create an input element
        var inputBox = document.createElement('input');
        
        inputBox.type = 'file';
        inputBox.accept = '.csv';
        inputBox.style.position = 'fixed';
        inputBox.style.top = '10px'; // Positioned below the button
        inputBox.style.left = '40%';
        inputBox.style.transform = 'translateX(-50%)';
        inputBox.style.padding = '10px';
        inputBox.style.zIndex = '10000';
        inputBox.style.border = '1px solid #ccc';
        inputBox.style.borderRadius = '5px';
        inputBox.style.fontSize = '16px';
        inputBox.style.fontFamily = 'Arial, sans-serif';


        // Create radio buttons for last month and current month
        var radioLastMonth = document.createElement('input');
        radioLastMonth.type = 'radio';
        radioLastMonth.id = 'lastMonth';
        radioLastMonth.name = 'monthChoice';
        radioLastMonth.value = 'lastMonth';
        radioLastMonth.style.position = 'fixed';
        radioLastMonth.style.top = '10px';
        radioLastMonth.style.left = '58%';
        radioLastMonth.style.transform = 'translateX(-40%)';

        var labelLastMonth = document.createElement('label');
        labelLastMonth.htmlFor = 'lastMonth';
        labelLastMonth.innerText = 'Last Month';
        labelLastMonth.style.position = 'fixed';
        labelLastMonth.style.top = '10px';
        labelLastMonth.style.left = '58%';
        labelLastMonth.style.transform = 'translateX(20%)';

        var radioCurrentMonth = document.createElement('input');
        radioCurrentMonth.type = 'radio';
        radioCurrentMonth.id = 'currentMonth';
        radioCurrentMonth.name = 'monthChoice';
        radioCurrentMonth.value = 'currentMonth';
        radioCurrentMonth.style.position = 'fixed';
        radioCurrentMonth.style.top = '30px';
        radioCurrentMonth.style.left = '58%';
        radioCurrentMonth.style.transform = 'translateX(-40%)';

        var labelCurrentMonth = document.createElement('label');
        labelCurrentMonth.htmlFor = 'currentMonth';
        labelCurrentMonth.innerText = 'Current Month';
        labelCurrentMonth.style.position = 'fixed';
        labelCurrentMonth.style.top = '30px';
        labelCurrentMonth.style.left = '58%';
        labelCurrentMonth.style.transform = 'translateX(15%)';


        // Create the button
        var uploadTimesheetsBtn = document.createElement('button');
        uploadTimesheetsBtn.innerHTML = "UPLOAD TIMESHEETS";
        // Style the button (styles are as previously defined)
        uploadTimesheetsBtn.style.position = 'fixed';
        uploadTimesheetsBtn.style.top = '10px';
        uploadTimesheetsBtn.style.left = '80%';
        uploadTimesheetsBtn.style.transform = 'translateX(-50%)';
        uploadTimesheetsBtn.style.backgroundColor = '#4CAF50';
        uploadTimesheetsBtn.style.color = 'white';
        uploadTimesheetsBtn.style.padding = '10px 20px';
        uploadTimesheetsBtn.style.zIndex = '10000';
        uploadTimesheetsBtn.style.border = 'none';
        uploadTimesheetsBtn.style.borderRadius = '5px';
        uploadTimesheetsBtn.style.cursor = 'pointer';
        uploadTimesheetsBtn.style.fontSize = '16px';
        uploadTimesheetsBtn.style.fontFamily = 'Arial, sans-serif';

        // Add event listener for the button click
        uploadTimesheetsBtn.addEventListener('click', function() {
            if (inputBox.files.length > 0) { // Check if any file is selected
                var file = inputBox.files[0]; // Get the selected file
                var monthSelection = document.querySelector('input[name="monthChoice"]:checked');

                if (!monthSelection) {
                    alert('Please select a month first.');
                    return;
                }
                var reader = new FileReader(); // Create a FileReader object

                reader.onload = function(e) {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, {
                        type: 'binary'
                    });

                    // Log the first sheet's name
                    const firstSheetName = workbook.SheetNames[0];

                    // Convert the first sheet to JSON (an array of objects)
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {raw: true});

                    console.log(jsonData);
                    
                    if (monthSelection.value == "lastMonth") {
                        uploadForMultiplePersonsAndDays(jsonData, true);
                    } else {
                        uploadForMultiplePersonsAndDays(jsonData, false);
                    }
                };

                reader.readAsText(file); // Read the file as text
            } else {
                alert('Please select a file first.');
            }
        });

        // Append the input box and the button to the body
            document.body.appendChild(inputBox);
            document.body.appendChild(radioLastMonth);
            document.body.appendChild(labelLastMonth);
            document.body.appendChild(radioCurrentMonth);
            document.body.appendChild(labelCurrentMonth);
            document.body.appendChild(uploadTimesheetsBtn);
    }


    // Call the function
    if (window.location.hostname !== "https://elmo.yourpayroll.com.au") {
        console.log("This script only runs on https://elmo.yourpayroll.com.au");
    } else {
        createUploadButton()
        console.log("performing the upload");
    }
    
   
})();
