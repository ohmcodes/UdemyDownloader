var windowNotOpenTitle = 'Open popup window';
var windowIsOpenTitle = 'Popup window is already open. Click to focus popup.';
var popupWindowId = false; //popupWindowId can be true, false, or the popup's window Id.

chrome.browserAction.onClicked.addListener(function () {
    let width= 1092;
    let height= 700;
    if(popupWindowId === false){
        popupWindowId = true; //Prevent user pressing pressing the button multiple times.
        chrome.browserAction.setTitle({title:windowIsOpenTitle});
        chrome.windows.create({ 
            'url': 'popup.html', 
            'type': 'popup',
            'width': width,
            'height': height,
            'left': (screen.width/2) - (width/2),
            'top': (screen.height/2) - (height/2),
            'focused': true
        },
        function(win){
            popupWindowId = win.id;
        });
        return;
    }else if(typeof popupWindowId === 'number'){
        //The window is open, and the user clicked the button.
        //  Focus the window.
        chrome.windows.update(popupWindowId,{focused:true});
    }
});
chrome.windows.onRemoved.addListener(function (winId){
    if(popupWindowId === winId){
        //chrome.browserAction.enable();
        chrome.browserAction.setTitle({title:windowNotOpenTitle});
        popupWindowId = false;
    }
});