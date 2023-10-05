import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { debounce } from '@ember/runloop';
import { tracked } from '@glimmer/tracking';
import ShowSeriesValidations from '../../validations/show-series';
import type ShowSeries from 'datafruits13/models/show-series';
import type User from 'datafruits13/models/user';
import dayjs, { Dayjs } from "dayjs";
import { BufferedChangeset } from 'ember-changeset/types';

interface UserShowFormArgs {
  show: ShowSeries;
}

export default class UserShowForm extends Component<UserShowFormArgs> {
  ShowSeriesValidations = ShowSeriesValidations;

  @service declare router: any;
  @service declare store: any;

  file: Blob | null = null;

  @tracked users: User[] = [];
  @tracked errors: { [key: string]: string[] } = {};

  @tracked shouldShowEndDate = false;

  weekdayCadences = [
    'First',
    'Second',
    'Third',
    'Forth',
    'Last'
  ];

  @action
  updateFile(e: any){
    this.file = e.target.files[0];
    this.args.show.imageFilename = e.target.files[0].name;
    const reader = new FileReader();

    reader.onload = (e) => {
      this.args.show.image = e.target?.result as string;
    };
    reader.onerror = (e) => {
      console.log('error reading file');
      console.log(e);
    };

    reader.readAsDataURL(this.file as Blob);
  }

  @action
  saveShow(event: any) {
    event.preventDefault();
    const show = this.args.show;
    try {
      show.save().then(() => {
        alert('saved the show!');
        this.router.transitionTo('home.show', show.title);
      });
    } catch (error) {
      alert('could not save show :(');
      console.log(error);
    }
  }

  @action
  setRepeating(changeset: BufferedChangeset, event: any) {
    if(event.target.value === 'true') {
      if(changeset.recurringInterval === 'not_recurring') {
        changeset.set('recurringInterval', 'week');
      }
    } else {
      changeset.set('recurringInterval', 'not_recurring');
    }
  }

  @action
  onSubmit(result: any, event: any) {
    console.log(result);
    console.log(event);
    this.router.transitionTo('home.show', result);
  }

  @action
  onError(errors: [{ [key: string]: string[] }]) {
    window.alert("Couldn't save show, check the form for errors");
    console.log('couldnt ssave show');
    console.log(errors);
    console.log(errors[0]);
    this.errors = errors[0];
  }

  @action
  setEndAfterStart(startTime: Dayjs, changeset: BufferedChangeset) {
    if(startTime.hour() > dayjs(changeset.get('endTime')).hour()) {
      console.log('setting end time to: ', startTime.add(1, 'hour').hour());
      changeset.set('endTime', startTime.add(1, 'hour'));
    }
  }

  @action
  adjustRecurringForDate(changeset: BufferedChangeset, event: any) {
    const date = new Date(event.target.value.split("-").join(","));
    if(changeset.recurringInterval !== 'not_recurring') {
      const weekday = date.getDay();
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      changeset.set('recurringWeekday', weekdays[weekday]);
      if (changeset.recurringInterval === 'month') {
        const cadence = this._getWeekdayCadenceInMonth(date);
        changeset.set('recurringCadence', cadence);
      }
    }
  }

  _getWeekdayCadenceInMonth(date: Date): string {
    const dayOfMonth: number = date.getDate();

    const dayOfWeek: number = date.getDay();

    const firstDay: number = dayOfMonth - dayOfWeek;

    const position: number = Math.floor(firstDay / 7) + 1;

    let label: string;

    if (position === 1) {
      label = 'First';
    } else if (position === 2) {
      label = 'Second';
    } else if (position === 3) {
      label = 'Third';
    } else if (position === 4 || (position === 5 && dayOfMonth + 7 > new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())) {
      label = 'Last';
    } else {
      label = 'Fourth';
    }

    return label;
  }

  @action
  searchDjs(term: string) {
    return new Promise((resolve, reject) => {
      debounce(this, this._performDjsSearch, term, resolve, reject, 600);
    });
  }

  _performDjsSearch(term: string, resolve: any, reject: any) {
    this.store
      .query('user', {
        search: {
          keyword: term,
        },
      })
      .then((users: any) => {
        this.users = users;
        return resolve(users);
      }, reject);
  }

  get currentDate() {
    return (new Date()).toISOString().split("T")[0]
  }
}
