import Service, { inject as service } from '@ember/service';
import { Presence, Channel } from 'phoenix';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { tracked } from '@glimmer/tracking';
import SocketService from 'datafruits13/services/socket';
import EventBusService from 'datafruits13/services/event-bus';
import CurrentUserService from 'datafruits13/services/current-user';

interface FruitCount {
  [key: string]: number;
}

export default class ChatService extends Service {
  @service declare socket: SocketService;
  @service declare session: any;
  @service declare eventBus: EventBusService;
  @service declare currentUser: CurrentUserService;

  @tracked presences = {};
  @tracked messages: Array<string> = [];
  @tracked joinedChat: boolean = false;
  @tracked gifsEnabled: boolean = true;
  @tracked token: string = '';

  @tracked isScrolledToBottom: boolean = true;

  @tracked _fruitCounts: FruitCount = {};

  @tracked loading: boolean = true;

  username: string = '';

  chan: Channel;
  notificationChan: Channel;

  setFruitCount(key: string, value: number) {
    this._fruitCounts[key] = value;
    this._fruitCounts = { ...this._fruitCounts };
  }

  getFruitCount(key: string) {
    return this._fruitCounts[key];
  }

  join(username: string, token: string) {
    this.joinedChat = true;
    this.username = username;
    this.token = token;
  }

  joinAndAuthorize(user: any, token: string) {
    this.joinedChat = true;
    this.username = user.username;
    this.token = token;

    const avatarUrl = user.avatarUrl;
    const role = user.role;
    const style = user.style;
    const pronouns = user.pronouns;
    this.push('authorize_token', {
      user: user.username,
      timestamp: Date.now(),
      token: token,
      avatarUrl,
      role,
      style,
      pronouns,
    });
  }

  disconnect() {
    // need to broadcast a disconnect here or it will look like user is still in the chat to everyone
    this.chan.push('disconnect', { user: this.username });
    this.joinedChat = false;
  }

  push(message: string, object: any) {
    this.chan.push(message, object);
  }

  onTrackPlayed(event: any) {
    console.log(event);
    this.chan.push("track_playback", { track_id: event.id })
  }

  constructor() {
    super(...arguments);

    const socket = this.socket.socket;

    this.chan = socket.channel('rooms:lobby', {});

    this.chan
      .join()
      .receive('ok', () => {
        if (isDestroyed(this) || isDestroying(this)) return;
        if (this.session.isAuthenticated && this.currentUser.user) {
          this.joinAndAuthorize(this.currentUser.user, this.session.data.authenticated.token);
        } else {
          this.loading = false;
          return console.log('chat join ok'); // eslint-disable-line no-console
        }
      })
      .receive('timeout', function () {
        //return console.log("Connection interruption");
      });

    this.chan.onError(function (/*e*/) {
      //return console.log("something went wrong", e);
    });

    this.chan.onClose(function (/*e*/) {
      //return console.log("channel closed", e);
    });

    this.chan.on('new:msg', (msg) => {
      if (msg['role']) {
        msg['role'] = msg.role.split(' ');
      }
      if (this.currentUser.user) {
        msg.hasMention = msg.body.indexOf(`@${this.currentUser.user.username}`) > -1;
      }
      this.messages = [...this.messages, msg];
    });

    this.chan.on('new:fruit_tip', (msg) => {
      // log fruit tip data { count: ..., }
      console.log(msg);
      this.setFruitCount("total", msg.total_count);
      this.setFruitCount(msg.fruit, msg.count);
      this.eventBus.publish("fruitTipped", msg.fruit);
    });

    this.chan.on('authorized', (msg) => {
      this.username = msg.user;
      const token = msg.token;
      if (token) {
        this.token = msg.token;
        // load currentUser
        this.currentUser
          .load()
          .then(() => {
            console.log('user authorized with token'); // eslint-disable-line no-console
            this.loading = false;
            this.joinedChat = true;
          })
          .catch(() => this.session.invalidate());
      } else {
        console.log('user authorized'); // eslint-disable-line no-console
        this.loading = false;
        this.joinedChat = true;
      }
      // fetch currentUser here? ???
    });

    this.chan.on('notauthorized', function (msg) {
      alert(msg.error);
    });

    // user banned
    this.chan.on('disconnect', (/*msg*/) => {
      this.joinedChat = false;
    });

    this.chan.on('banned', (msg) => {
      console.log(`user banned:`); // eslint-disable-line no-console
      console.log(msg); // eslint-disable-line no-console
    });

    this.chan.on('presence_state', (state) => {
      if (isDestroyed(this) || isDestroying(this)) return;
      const presences = this.presences;
      this.presences = Presence.syncState(presences, state);
    });

    this.chan.on('presence_diff', (diff) => {
      if (isDestroyed(this) || isDestroying(this)) return;
      const presences = this.presences;
      this.presences = Presence.syncDiff(presences, diff);
    });

    this.chan.on('fruit_counts', (counts: FruitCount) => {
      for (const [key, value] of Object.entries(counts)) {
        this.setFruitCount(key, value);
      }
    });

    this.eventBus.subscribe('trackPlayed', this, 'onTrackPlayed');

    this.notificationChan = socket.channel('user_notifications', {});

    this.notificationChan
      .join()
      .receive('ok', () => {
        if (isDestroyed(this) || isDestroying(this)) return;
          return console.log('notification chan join ok'); // eslint-disable-line no-console
      })
      .receive('timeout', function () {
        //return console.log("Connection interruption");
      });

    this.notificationChan.on('new:msg', (msg) => {
      if (this.currentUser.user) {
        msg.hasMention = msg.body.indexOf(`@${this.currentUser.user.username}`) > -1;
      }
      this.messages = [...this.messages, msg];
    });

  }
}
