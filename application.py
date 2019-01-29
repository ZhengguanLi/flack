import os
import time
import random
from collections import deque
from datetime import datetime

from flask import Flask, render_template, request, session, redirect, url_for, g
from flask_socketio import SocketIO, send, emit
from flask_session import Session

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
app.config['DEBUG'] = 1

Session(app)
socketio = SocketIO(app)

# dataset stored on the server
usernames = set()
channel_names = ['Welcome']
personal_data = {}
channels_data = {'Welcome':{'profile_pics':deque(), 'headers':deque(), 'content':deque()}}
# personal_data{(person1, person2): {'profile_pics':deque(), header':deque(), 'content':deque()}
# channels_data{'channel_name': {'profile_pic':deque(), 'header': deque(), 'content': deque()}}

# render main/home page, or redirect channel page
@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        session.pop('username', None)
        username = request.form.get('username')
        session['username'] = username
        usernames.add(username)

        # choose profile pictures
        profiles_bing = ['Erbing', 'Fanbingbing', 'Gongzhubing', 'Libingbing', 'Malisubing', 'Missbing', 'Shenjingbing', 'Youmaobing', 'Zhongerbing']
        profiles_qq = list(range(91))
        profiles = profiles_bing + profiles_qq
        profile_src = random.choice(profiles)
        session['profile_src'] = profile_src

        emit('announce new user', session['username'], broadcast=True, namespace='/')
        return redirect(url_for('channel_page'))
    else:
        return render_template('index.html')

# check if the username exists
@socketio.on('check username', namespace='/')
def check_username(username):
    exist = 'true' if username in usernames else 'false' 
    emit('username exists', exist)

# render channel page
@app.route('/channel/')
def channel_page():
    if 'username' in session:
        username = session['username']
        usernames_list = list(usernames)
        profile_pics = list(channels_data['Welcome']['profile_pics'])
        headers = list(channels_data['Welcome']['headers'])
        content = list(channels_data['Welcome']['content'])
        headers.reverse()
        content.reverse()
        return render_template('channel.html', profile_src=session['profile_src'], username=username, profile_pics=profile_pics, headers=headers, content=content, channel_names=channel_names, usernames=usernames_list)
    else:
        return render_template('index.html')

# receive and broadcast messages in channel
@socketio.on('send message', namespace='/')
def handle_message(data): 
    # data{'type', 'profile_pic', 'sender_name', 'chat_type', 'chat_name', 
    #       'time', 'content'/'coontent'{'filename', 'file_base64', 'filesize'}}

    # add header, update server
    sender_name = data['sender_name']
    chat_type = data['chat_type']
    chat_name = data['chat_name']
    # time = datetime.now().strftime('%m/%d/%Y %H:%M:%S %p')
    data['header'] = sender_name + ' ' + data['time']
    
    store_data = {}
    if(chat_type == 'Channel'):
        store_data = channels_data[chat_name]
    else:
        couple = [sender_name, chat_name]
        couple.sort()
        couple = tuple(couple)
        store_data = personal_data[couple]
    if len(store_data['headers']) > 99:
        store_data['profile_pics'].popleft()
        store_data['headers'].popleft()
        store_data['content'].popleft()
    store_data['profile_pics'].append(data['profile_pic'])
    store_data['headers'].append(data['header'])
    store_data['content'].append(data['content'])

    emit('announce message', data, broadcast=True)

# initalize new channel data struture and broadcast new channel name
@socketio.on('send new channel', namespace='/')
def new_channel(channel_name):
    # add channel name to channel names list
    # channel name must be unique, give repeat info:TODO
    if channel_name not in channel_names:
        channel_names.append(channel_name)
        # initiate channel data to channels data
        channels_data[channel_name] = {}
        channels_data[channel_name]['profile_pics'] = deque()
        channels_data[channel_name]['headers'] = deque()
        channels_data[channel_name]['content'] = deque()
        emit('announce new channel', channel_name, broadcast=True)
        emit('channel created success', channel_name)
    else:
        emit('announce repeat channel')

# send stored channel messages to client
@socketio.on('change channel', namespace='/')
def change_channel(channel_name):
    #load chat history
    data = {}
    data['type'] = 'message'
    data['channel_name'] = channel_name
    data['profile_pics'] = list(channels_data[channel_name]['profile_pics'])
    data['headers'] = list(channels_data[channel_name]['headers'])
    data['content'] = list(channels_data[channel_name]['content'])
    
    # data{'channel_name', 'profile_pics', 'headers':[], 'content':[]}
    emit('announce channel change', data)

# send stored personal message between sender_name and receiver_name to client
@socketio.on('change person', namespace='/')
def change_person(data):
    # data['sender_name', 'receiver_name']
    # make tuple key: couple
    sender_name = data['sender_name']
    receiver_name = data['receiver_name']
    couple = [sender_name, receiver_name]
    couple.sort()
    couple = tuple(couple)
    
    headers = []
    content = []
    if couple in personal_data:
        profile_pics = list(personal_data[couple]['profile_pics'])
        headers = list(personal_data[couple]['headers'])
        content = list(personal_data[couple]['content'])
    else:
        personal_data[couple] = {}
        personal_data[couple]['profile_pics'] = deque()
        personal_data[couple]['headers'] = deque()
        personal_data[couple]['content'] = deque()

    data['profile_pics'] = profile_pics
    data['headers'] = headers
    data['content'] = content

    # data['sender_name', 'receiver_name', 'profile_pics':[], 'headers':[], 'content':[]]
    emit('announce person change', data)

# remove the user from the user list, go back to home page
@app.route('/')
def quit():
    if(session['username'] in usernames):
        usernames.remove(session['username'])
        emit('announce user leave', session['username'], broadcast=True, namespace='/')
        session.pop('username', None)
        session.pop('profile_src', None)
    return redirect(url_for('index'))

if __name__ == '__main__':
	socketio.run(app)