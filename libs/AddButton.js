function addCustomButton() {
  
    const actionsButton = document.querySelector('.pgm_action_menu'); 

    if (actionsButton && !document.querySelector('#my-custom-button')) {
        const button = document.createElement('button');
        button.id = 'my-custom-button';
        button.innerText = 'My Custom Button';
        button.style.backgroundColor = '#E0E0E0';
        button.style.color = '#333';
        button.style.border = '1px solid #A0A0A0';
        button.style.padding = '5px 15px';
        button.style.cursor = 'pointer';
        button.style.marginLeft = '10px'; 
        button.style.fontSize = '13px';
        button.style.fontWeight = 'bold';
        button.style.borderRadius = '3px';
        button.style.boxShadow = 'none';

      
        actionsButton.parentNode.insertBefore(button, actionsButton.nextSibling);

        
        button.addEventListener('click', () => {
          
            const url = chrome.runtime.getURL('popup.html'); 

       
            const windowFeatures = 'width=500,height=500,top=100,left=100,scrollbars=yes,resizable=yes';
            const floatingWindow = window.open(url, 'FloatingWindow', windowFeatures);

           
            if (!floatingWindow) {
                alert('Popup blocked! Please allow popups for this site.');
            }
        });

        console.log('Button successfully added to the right of Actions.');
    } else {
        console.log('Could not find the Actions button to inject the custom button.');
    }
}

