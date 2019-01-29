document.addEventListener('DOMContentLoaded', () => {
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port, {transports: ['websocket']});

    document.querySelector('#username').onkeyup = () => {
        const username = document.querySelector('#username');
        if(username.value.length > 9){
            document.querySelector('#go-chat-btn').setAttribute('disabled', true);
            document.querySelector('#username-long').style.display = 'block';
        }else{
            document.querySelector('#username-long').style.display = 'none';
            document.querySelector('#go-chat-btn').removeAttribute('disabled');
            socket.emit('check username', username.value);
        };
    };

    socket.on('username exists', exist => {
        if(exist === 'true'){
            document.querySelector('#go-chat-btn').setAttribute('disabled', true);
            document.querySelector('#username-existed').style.display = 'block';
        }else{
            document.querySelector('#username-existed').style.display = 'none';
            document.querySelector('#go-chat-btn').removeAttribute('disabled');
        };
    });

    // open or close sidebar
    document.querySelector('#sidebarCollapse').onclick = () => {
        $('#sidebar').toggleClass('active');
    };
});