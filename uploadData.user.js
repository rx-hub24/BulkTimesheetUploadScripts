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
    function showAlert(message) {
        alert("Error: " + message);
    }
    
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
            credentials: 'include',
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

    function formatDateFromISOString(isoString) {
        const date = new Date(isoString);
    
        // Get the day, month, and year from the date object
        const day = date.getDate().toString().padStart(2, '0'); // Ensure two digits
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Ensure two digits, month is 0-indexed
        const year = date.getFullYear();
    
        // Construct the date string in dd/mm/yyyy format
        return `${day}/${month}/${year}`;
    }    

    function getHoursDifference(start, end) {
        // Parse the start and end times into Date objects
        const startTime = new Date(start);
        const endTime = new Date(end);
    
        // Calculate the difference in milliseconds
        const differenceInMilliseconds = endTime - startTime;
    
        // Convert milliseconds to hours (1000 milliseconds = 1 second, 3600 seconds = 1 hour)
        const differenceInHours = differenceInMilliseconds / (1000 * 3600);
    
        return differenceInHours;
    }

    /*
    This function is to fix the date convertion that js
    automatically does when reading csv file. It converts
    dates in date integers, but reads the dates as if they
    are in mm/dd/yyyy so need to switch the month and date around
    */
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

    function aggregateData(hoursByDate) {
        const outputData = [];
        const employeeId = getEmployeeIdFromURL();
        console.log(hoursByDate);
        console.log("collected hours");
        
        let breakStart;
        let breakEnd;
        let totalHours;
        let date;

        // Generate final outputData from hoursByDate
        let breaks;
        hoursByDate.forEach((value, key) => {
            breaks = []
            var breakLength = 0;
            totalHours = value.totalHours;
            date = value.date;
            console.log(totalHours);

            const ausStart = new Date(date.setHours(9, 0, 0, 0));
            // Convert to the correct UTC time representing 9 AM local time
            const timeZoneOffsetInMs = ausStart.getTimezoneOffset() * 60 * 1000;
            const startDateTime = new Date(ausStart.getTime() - timeZoneOffsetInMs);

            if (totalHours > 4) {
                breakLength = 0.5;
                breakStart = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000);
                breakEnd = new Date(breakStart.getTime() + 30 * 60 * 1000);
                breaks.push({
                    start: breakStart.toISOString(),
                    end: breakEnd.toISOString(),
                    isPaid: false
            });}

            const endDateTime = new Date(startDateTime.getTime() + (totalHours + breakLength) * 60 * 60 * 1000);
            console.log(endDateTime);
            const entry = {
                employeeId: employeeId || "Unknown",
                daysWorked: [{
                    startTime: startDateTime.toISOString(),
                    endTime: endDateTime.toISOString(),
                    breaks: breaks
                }]
            };

            outputData.push(entry);
        });

        // Assuming we're logging the output data as a string for demonstration
        console.log(outputData);
        return outputData
    }


    function processCsvData(csvString, month) {
        const employee = getEmployeeName();
        
        console.log("Processing csv data");
        var fields = csvString
        console.log(fields.length);

        const hoursByDate = new Map();

        // Iterate through each entry
        for (let i = 1; i < fields.length; i += 1) {

            // Extract fields for the current record
            const entry = fields[i];

            const name = entry["Created By"];
            
            if (name == null || name == employee) {
                const dateString = entry["Date"];
                let hours = parseFloat(entry["Hours Worked"]);
                let dateVal;
                let curMonth;
                let dateKey;
                try {
                    if (Number.isInteger(dateString)) {
                        var returnVal = excelDateToJSDate(dateString);
                        dateVal = returnVal[0];
                        curMonth = returnVal[1];
                        dateKey = dateVal.toISOString().slice(0, 10);
    
                    } else {
                        var [day, mnth, year] = dateString.split('/');
                        curMonth = mnth;
                        console.log(curMonth);
                        dateVal = new Date(`${year}-${curMonth}-${day}`);
                        dateKey = `${year}-${mnth.padStart(2, '0')}-${day.padStart(2, '0')}`; // YYYY-MM-DD format
    
                    }
    
                    // Check if the month matches
                    if (month == curMonth) {
                        if (!hoursByDate.has(dateKey)) {
                            hoursByDate.set(dateKey, {
                                totalHours: 0,
                                date: dateVal
                            });
                        }
    
                        const dayData = hoursByDate.get(dateKey);
                        dayData.totalHours += hours;
                    }
                } catch (error) {
                    showAlert("Problem with entry- skipping this entry" + error.message);
                }
                
            }
        }

        var data = aggregateData(hoursByDate);
        return data;
    }

    function showTimesheetPopup(day, numHours) {
        // Check if the container for popups exists; if not, create it
        let container = document.getElementById("popup-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "popup-container";
            document.body.appendChild(container);
            
            // Style the container. Adjust as needed.
            container.style.position = "fixed";
            container.style.bottom = "20px";
            container.style.right = "20px";
            container.style.zIndex = "1000";
        }

        // Create the popup message element
        const popup = document.createElement("div");
        popup.className = "popup-message";
        popup.innerHTML = `
            <strong>Timesheet Uploaded:</strong> ${day}, ${numHours} hours
            <span class="close-btn">&times;</span>
        `;
        
        // Style the popup. Adjust styles as needed.
        popup.style.background = "#4CAF50";
        popup.style.border = "1px solid #ccc";
        popup.style.borderRadius = "5px";
        popup.style.padding = "10px";
        popup.style.marginTop = "5px"; // For stacking
        popup.style.boxShadow = "0 2px 4px rgba(0,0,0,.5)";

       // Modified close functionality to check if it's the last popup
        popup.querySelector(".close-btn").onclick = function() {
            popup.remove(); // Remove the clicked popup
            // Check if it was the last popup and reload the page if so
            if (!container.hasChildNodes()) {
                window.location.reload();
            }
        };

        // Append the popup to the container
        container.appendChild(popup);

        // Automatically remove the popup after 60 seconds and check if the page should reload
        setTimeout(() => {
            popup.remove(); // Remove the popup
            // After removal, check if there are no more popups and reload the page if so
            if (!container.hasChildNodes()) {
                window.location.reload();
            }
        }, 60000); // 60,000 milliseconds = 60 seconds
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

    async function uploadAllDays(input, lastMonth) {
        var chosenMonth = null;
        if (lastMonth) {
            chosenMonth = getLastMonth();
        } else {
            chosenMonth = getCurrentMonth();
        }

        var data = processCsvData(input, chosenMonth);
        var numEntriesUploaded = 0;
        let hours;
        let datey;
        for (const entry of data) {
            const { employeeId, daysWorked } = entry;
            const timesheets = daysWorked.map(day => {
                const { startTime, endTime, breaks } = day;
                hours = getHoursDifference(startTime, endTime);
                if (hours > 4) {
                    hours = hours - 0.5;
                }
                datey = formatDateFromISOString(startTime);
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
            showTimesheetPopup(datey, hours);
            numEntriesUploaded += 1;
        }
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
                        uploadAllDays(jsonData, true);
                    } else {
                        uploadAllDays(jsonData, false);
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


    // Call the function only if user is at correct website
    // will not show if website is inserted as frame
    if (window.self === window.top) {
        createUploadButton()
        console.log(window.location.href);

        console.log("performing the upload");
    } else {

        console.log("This script only runs on https://elmo.yourpayroll.com.au");

    }
 })();