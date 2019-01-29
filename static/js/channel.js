document.addEventListener('DOMContentLoaded', () => {
    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port, {transports: ['websocket']});
    var pageTitleNotification = (() => {
        var config = {
            currentTitle: null,
            interval: null
        };
    
        var on = (notificationText, intervalSpeed) => {
            if(config.interval === null){
                config.currentTitle = document.title;
                config.interval = window.setInterval(() => {
                    document.title = document.title === config.currentTitle? 
                        notificationText? notificationText: "New Chat Message!": config.currentTitle;
                }, intervalSpeed? intervalSpeed: 1000);
            }
        };
    
        var off = () => {
            if(config.interval !== null){
                window.clearInterval(config.interval);
                document.title = config.currentTitle;
                config.interval = null;
            };
        };
    
        return{
            on: on,
            off: off
        };
    })();

    var newMessage = {
        total: 0,
        channel: {},
        person: {}
    }

    // initialize the newMessages
    document.querySelectorAll(".channel-name").forEach(a => {
        var channel_name = a.children[0].innerHTML.trim();
        newMessage['channel'][channel_name] = 0;
    });
    document.querySelectorAll(".username").forEach(a => {
        var username = a.children[0].innerHTML.trim();
        newMessage['person'][username] = 0;
    });

    
    // ---------------------------messages---------------------------------------
    // send button
    document.querySelector("#send").onclick = () => {
        var content_input = document.querySelector('#message');       
        var content = content_input.emojioneArea.getText();
        var profile_pic = document.querySelector('#profile-pic').getAttribute('src');
        var sender_name = document.querySelector('#profile').innerHTML;
        var chat_type = document.querySelector('#chat-type').innerHTML;
        var chat_name = document.querySelector('#chat-name').innerHTML;
        var time = new Date().toLocaleString();

        content_input.emojioneArea.setText(''); // clear message input
        socket.emit('send message', {'type':'message', 'profile_pic': profile_pic, 'sender_name':sender_name, 'chat_type':chat_type, 'chat_name':chat_name, 
                                    'time':time, 'content': content});
        return false;
    };

    // send message, event: message form is submitted
    socket.on('connect', () => {
        document.querySelector('#message-form').onsubmit = () => {     
            var content_input = document.querySelector('#message');       
            var content = content_input.emojioneArea.getText().trim();
            var profile_pic = document.querySelector('#profile-pic').getAttribute('src');
            var sender_name = document.querySelector('#profile').innerHTML;
            var chat_type = document.querySelector('#chat-type').innerHTML;
            var chat_name = document.querySelector('#chat-name').innerHTML;
            var time = new Date().toLocaleString();

            content_input.emojioneArea.setText(''); // clear message input
            socket.emit('send message', {'type':'message', 'profile_pic':profile_pic, 'sender_name':sender_name, 'chat_type':chat_type, 'chat_name':chat_name, 'time':time, 
                                        'content': content});
            return false;
        };
    });

    // receive message
    socket.on('announce message', data => {
        // data{'type', 'profile_pic', 'sender_name', 'chat_type', 'chat_name', 'header', 'content'/'content'{filename', 'file_base64', 'filesize'}}

        var username = document.querySelector('#profile').innerHTML;
        var chat_type = document.querySelector('#chat-type').innerHTML;
        var chat_name = document.querySelector('#chat-name').innerHTML;
        
        if(chat_type === data['chat_type'] && 
                ((chat_type === 'Channel' && data['chat_name'] === chat_name) ||
                (chat_type === 'Personal' && ((data['sender_name'] === username && data['chat_name'] === chat_name) || 
                                            (data['chat_name'] === username && data['sender_name'] === chat_name))))){
            add_message(data); 
        }else{
            // add badges
            if(data['chat_type'] === 'Channel'){
                newMessage['total']++;
                newMessage['channel'][data['chat_name']]++;
                document.querySelectorAll('.channel-name').forEach(a => {
                    if(a.children[0].innerHTML.trim() === data['chat_name']){
                        a.children[1].innerHTML = newMessage['channel'][data['chat_name']];
                        a.children[1].removeAttribute('hidden'); // show badges
                    };
                });
                pageTitleNotification.on();
            }else if(data['chat_type'] === 'Personal' && data['chat_name'] === username){
                newMessage['total']++;
                newMessage['person'][data['sender_name']]++;
                document.querySelectorAll('.username').forEach(a => {
                    console.log(a.children[0].innerHTML.trim());
                    if(a.children[0].innerHTML.trim() === data['sender_name']){
                        a.children[1].innerHTML = newMessage['person'][data['sender_name']];
                        a.children[1].removeAttribute('hidden'); // show badges
                    };
                });
                pageTitleNotification.on();
            };
        };
    });

    // ------------------------------new user comes-------------------------
    // append new username to people list
    socket.on('announce new user', username => {
        newMessage['person'][username] = 0;
        var tbody = document.querySelector('#user-list');
        var tr = document.createElement('tr');
        tr.innerHTML = `<td class="user">
                            <a href="javascript:;" class="username">
                                <span>${username}</span>
                                <span class="badge badge-success" hidden>0</span>
                            </a>
                        </td>`;
        tbody.append(tr);
    });
    
    // ----------------------------------channel------------------------------    
    // autofocus for modal input
    $('#exampleModal').on('shown.bs.modal', function () {
        $('#new-channel-name').trigger('focus');
    });

    document.querySelector('#new-channel-form').onsubmit = () => {
        $('#exampleModal').modal('hide');

        var channel_name = document.querySelector('#new-channel-name').value;
        document.querySelector('#new-channel-name').value = ""; // clear input
        socket.emit('send new channel', channel_name);
        return false;
    }

    
    // receive new channel name, append it to channel table
    socket.on('announce new channel', channel_name => {
        var tbody = document.querySelector('#channel-list');
        var tr = document.createElement('tr');
        tr.innerHTML = `<td>
                            <a href="javascript:;" class="channel-name">
                               <span>${channel_name} </span>
                               <span class="badge badge-success" hidden>0</span>   
                            </a>
                        </td>`;
        tbody.append(tr);
        newMessage['channel'][channel_name] = 0;
    });

    // show modal and switch to new channel when channel created
    socket.on('channel created success', channel_name => {
        $('#congrats').modal('show');
        document.querySelector('#user-list').style.display = 'none';
        document.querySelector('#channel-list').style.display = 'block';
        document.querySelectorAll('.channel-name').forEach(a => {
            if(a.children[0].innerHTML.trim() === channel_name){
                a.click();
            };
        });
    });

    // channel name is invalid
    socket.on('announce repeat channel', () => {
        $('#channelRepeatModal').modal('show');
    });

    // retry: redirect to new channel modal 
    document.querySelector('#retry').onclick = () => {
        document.querySelector('#new-channel').click();
    }

    // change channel, event: channel anchor is clicked
    document.addEventListener('click', event => {
        var element = event.target;
        if(element.parentNode.className === 'channel-name'){
            element = element.parentNode;
        }

        if(element.className === 'channel-name'){
            var channel_name = element.children[0].innerHTML.trim(); // unknown: don't know why append/prepend '\n'
            var cur_chat_type = document.querySelector("#chat-type").innerHTML;
            var cur_chat_name = document.querySelector('#chat-name').innerHTML;
            
            document.querySelector('#chat-type').innerHTML = 'Channel';
            document.querySelector('#chat-name').innerHTML = channel_name;
            document.querySelector('#message-list').innerHTML = ''; // clear chat window

            removeBackgroundColor();
            element.style.backgroundColor = "green";
            
            // pageTitleNotification
            newMessage['total'] -= newMessage['channel'][channel_name];
            newMessage['channel'][channel_name] = 0;
            element.children[1].setAttribute('hidden', ""); // hide badges
            if(newMessage['total'] === 0){
                pageTitleNotification.off();
            };

            // send channel change request to server
            socket.emit('change channel', channel_name);
        };
    });
    
    // load channel messages 
    socket.on('announce channel change', data => {
        // data{'channel_name', 'profile_pics', 'headers':[], 'content':[]}
        data['headers'].forEach((header, index) => {
            new_data = {};
            new_data['type'] = data['content'][index] instanceof Object == true? 'file': 'message';
            new_data['profile_pic'] = data['profile_pics'][index]
            new_data['header'] = header;
            new_data['content'] = data['content'][index];
            add_message(new_data);
        });
    });

    // ------------------------------------person-------------------------------------------
    // talk to person
    document.addEventListener('click', event => {
        var element = event.target;
        if(element.parentNode.className === 'username'){
            element = element.parentNode;
        }
        if(element.className === 'username'){        
            removeBackgroundColor();
            element.style.backgroundColor = "green";

            var sender_name = document.querySelector('#profile').innerHTML;
            var receiver_name = element.children[0].innerHTML.trim();
    
            // change my header, clear chat window
            document.querySelector('#chat-type').innerHTML = 'Personal';
            document.querySelector('#chat-name').innerHTML = receiver_name;
            document.querySelector('#message-list').innerHTML = ''; // clear current chat window

            // pageTitleNotification
            newMessage['total'] -= newMessage['person'][receiver_name];
            newMessage['person'][receiver_name] = 0;
            element.children[1].setAttribute('hidden', ""); // hide badges
            if(newMessage['total'] === 0){
                pageTitleNotification.off();
            };

            socket.emit('change person', {'sender_name': sender_name, 'receiver_name': receiver_name});
        };
    });

    // load personal messages, append to message list
    socket.on('announce person change', data => {
        // data['sender_name', 'receiver_name', 'header':[], 'content':[]]
        data['headers'].forEach((header, index) => {
            new_data = {};
            new_data['type'] = data['content'][index] instanceof Object == true? 'file': 'message';
            new_data['profile_pic'] = data['profile_pics'][index];
            new_data['header'] = header;
            new_data['content'] = data['content'][index];
            add_message(new_data);
        });
    });

    // remove user if a user signs out
    socket.on('announce user leave', username => {
        document.querySelectorAll('.username').forEach(a => {
            if(a.children[0].innerHTML.trim() == username){
                a.parentNode.parentNode.remove();
            };
        });
    });

    // ----------------------------Not Socketio----------------------------------
    // user table collapse
    document.querySelector("#people").addEventListener('click', () => {
        var a = document.querySelector("#user-list");
        if(a.style.display === "block"){
            a.style.display = "none";
        }else{
            document.querySelector("#channel-list").style.display="none";
            a.style.display = "block";
        };
    });

    // channel table collapse
    document.querySelector("#channel").addEventListener('click', () => {
        var a = document.querySelector("#channel-list");
        if(a.style.display === "block"){
            a.style.display = "none";
        }else{
            document.querySelector("#user-list").style.display="none";
            a.style.display = "block";
        };
    });

    // -------------------------other functionalities part-----------------------------
    // delete specific message
    document.addEventListener("click", event => {
        var target = event.target;
        if(target.classList.contains('trash-icon')){
            var tr_header = target.parentNode.parentNode.parentNode;
            var tr_content = tr_header.nextElementSibling;
            tr_header.style.animationPlayState = 'running';
            tr_header.addEventListener('animationend', () => {
                tr_header.remove();
            });

            tr_content.style.animationPlayState = 'running';
            tr_content.addEventListener('animationend', () => {
                tr_content.remove();
            });
        };
    });

    // --------------------------clear chat window------------------------------------
    document.querySelector("#message-table thead th").addEventListener('click', () => {
        document.querySelector("#message-table tbody").innerHTML = "";
    });

    // ----------------------------file-------------------------
    document.querySelector("#file-btn").addEventListener("click", () => {
        document.querySelector('#file-input').click();   
    }); 

    // upload file
    document.querySelector('#file-input').onchange = () => {
        var sender_name = document.querySelector('#profile').innerHTML;
        var file = document.querySelector('#file-input').files[0];
        var profile_pic = document.querySelector('#profile-pic').getAttribute('src');
        var chat_type = document.querySelector('#chat-type').innerHTML;
        var chat_name = document.querySelector('#chat-name').innerHTML;
        var reader = new FileReader();
        reader.onload = event => {
            var filesize = getReadableFileSize(file.size);
            var content = {'filename': file.name, 'filesize': filesize, 'file_base64': reader.result}
            var time = new Date().toLocaleString();
            document.querySelector('#file-input').value = null;
            socket.emit('send message', {'type':'file', 'profile_pic': profile_pic, 'sender_name':sender_name, 'chat_type':chat_type, 'chat_name':chat_name, 
                                        'time':time, 'content': content});
        };
        reader.readAsDataURL(file);
        return false;
    };
    
    // -----------------update profile pic------------------------
    document.querySelector('#update-profile-pic').addEventListener('click', e => {
        alert("Coming in the next few days!");
    });

    // ------------------------search-----------------------------
    document.querySelector('#search').addEventListener('click', e => {
        alert("Coming in the next few days!");
    });

    // -----------------play, pause music-------------------------
    document.querySelector('#music-dropdown-menu').addEventListener('click', e => {
        var element = e.target;
        // pause all audios
        document.querySelectorAll('.music').forEach((music) => {
            music.pause();
        });

        // remove the check icon and append to chosen one
        var music_check_icon = document.querySelector("#music-check-icon");
        element.append(music_check_icon);

        // play the audio chosen
        var music_name = element.id;
        if(music_name !== "None"){
            document.querySelector(`#music-${music_name}`).play();
        };
    });

    // ----------------------text to speech---------------------
    // only English for now
    document.querySelector('#message-list').addEventListener('click', e => {
        var micro_icon = e.target;
        if(micro_icon.classList.contains('micro-icon')){
            var content = micro_icon.parentElement.parentElement.children[0].innerHTML;
            var msg = new SpeechSynthesisUtterance(content);
            window.speechSynthesis.speak(msg);
        };
    });

    // ---------------------ester egg: TODO------------------------
    // event: click easter egg anchor
    document.querySelector('#easter-egg').onclick = () => {
        // var secret = prompt('Please enter the secret');
        // socket.emit('send secret', secret);
        alert('TODO!');
    };
});

function removeBackgroundColor(){
    // remove background color
    document.querySelectorAll("#user-list a").forEach(a => {
        a.style.backgroundColor = null;
    });
    document.querySelectorAll("#channel-list a").forEach(a => {
        a.style.backgroundColor = null;
    });
};

function openForm() {
    document.getElementById("myForm").style.display = "block";
};

function closeForm() {
    document.getElementById("myForm").style.display = "none";
};

function add_message(data){
    var tbody = document.querySelector("#message-list");
    var tr = document.createElement('tr');
    tr.setAttribute('class', 'message-tr');
    tr.innerHTML = `<td class="message-header">
                        <img src=" ${data['profile_pic']}" width="30" height="30" alt="profile-pic">
                        ${data['header']}
                        <a href="javascript:;" class="trash-anchor">
                            <i class="fas fa-trash-alt trash-icon"></i>
                        </a>
                    </td>`;

    var tr2 = document.createElement('tr');
    tr2.setAttribute('class', 'message-tr');

    if(data['type'] === 'message'){
        tr2.innerHTML = `<td class="message-content">
                            <span class="content">${data['content']}</span>
                            <a href="javascript:;" class="micro-anchor">
                                <i class="fas fa-microphone-alt micro-icon"></i>
                            </a>
                        </td>`;
    }else{
        tr2.innerHTML = `<td class="message-content">
                            <a href="${data['content']['file_base64']}" download="${data['content']['filename']}" id="download">
                                <span class="content">Download: ${data['content']['filename']} (${data['content']['filesize']})</span>
                                <a href="javascript:;" class="micro-anchor">
                                    <i class="fas fa-microphone-alt micro-icon"></i>
                                </a>
                            </a>
                        </td>`;
    }    
    tbody.prepend(tr2);
    tbody.prepend(tr);
};

function getReadableFileSize(filesize){
    // convert file size to human readable format
    var cnt = -1;
    var byteUnits = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        filesize = filesize/1024;
        cnt++;
    } while (filesize > 1024);
    filesize = Math.max(filesize, 0.1).toFixed(1) + ' ' + byteUnits[cnt];
    return filesize;
}