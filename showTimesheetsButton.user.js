// ==UserScript==
// @name         Timesheets Button
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a button at the top middle of every webpage that redirects to Google.
// @author       Your Name
// @match        https://hub24.elmotalent.com.au/payroll/v5
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
  // Create a new button element
    var openTimesheetsBtn = document.createElement('button');
    openTimesheetsBtn.innerHTML = "Go to Timesheets"; // Set the text inside the button
    // Style the button
    openTimesheetsBtn.style.position = 'fixed';
    openTimesheetsBtn.style.top = '10px'; // Adjusted to not be exactly at the edge
    openTimesheetsBtn.style.left = '50%'; // Center the button horizontally
    openTimesheetsBtn.style.transform = 'translateX(-50%)'; // Adjust for exact centering
    openTimesheetsBtn.style.backgroundColor = '#4CAF50'; // A pleasant green
    openTimesheetsBtn.style.color = 'white';
    openTimesheetsBtn.style.padding = '10px 20px';
    openTimesheetsBtn.style.zIndex = '10000'; // Ensure it's on top of other content
    openTimesheetsBtn.style.border = 'none';
    openTimesheetsBtn.style.borderRadius = '5px';
    openTimesheetsBtn.style.cursor = 'pointer'; // Change cursor on hover
    openTimesheetsBtn.style.fontSize = '16px';
    openTimesheetsBtn.style.fontFamily = 'Arial, sans-serif';

    // Add click event listener to the button
    openTimesheetsBtn.addEventListener('click', function() {
        window.location.href = document.querySelector('[data-testid="elmo-menu-timesheet"]').href;
    });

    // Append the button to the body
    document.body.appendChild(openTimesheetsBtn);
})();
