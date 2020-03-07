import React from "react";
import ReactDOM from "react-dom";
import { connect, Provider } from "react-redux";
import { Action, Dispatch, Store, createStore } from "redux";
import produce, { Draft, setAutoFreeze } from "immer";

import "./index.css";

setAutoFreeze(false); // Refs in the cache should not be frozen.

const API_VERSION = "v1";

const SPACES_RE = /\s+/;

interface IHistory {
  prev: null | IHistory;
  value: IState;
  next: null | IHistory;
}

interface IState {
  job_list: IJobText[];
  jobs_of_t: {
    [k: string]: IJobText[];
  };
  jobs_of_d: {
    [k: string]: IJobText[];
  };
  selector_list: string[];
  save_success: boolean;
}

interface IJob {
  data: TContainer;
  desc: null | string;
  ds: TStringContainer;
  i: number;
  key: null | TStringContainer;
  priority: number;
  serial: boolean;
  successed: boolean;
  t: string;
  ts: TStringContainer;
}

interface IJobText {
  ts: string[];
  ds: string[];
  text: string;
}

type TStringContainer =
  | string
  | {
      [k: string]: string | TStringContainer;
    }
  | TStringContainer[];

type TContainer =
  | null
  | number
  | boolean
  | string
  | {
      [k: string]: string | TContainer;
    }
  | TContainer[];

interface IUpdateSelectorAction extends Action {
  type: "update_selector";
  i: number;
  selector: string;
}

interface IAddSelectorAction extends Action {
  type: "add_selector";
}

type TActions = IUpdateSelectorAction | IAddSelectorAction;

function* iterate_string_container(
  x: TStringContainer,
): Generator<string, any, undefined> {
  if (typeof x === "string") {
    yield x;
  } else if (Array.isArray(x)) {
    for (const k in x) {
      yield* iterate_string_container(x[k]);
    }
  } else {
    for (const k in x) {
      yield* iterate_string_container(x[k]);
    }
  }
}

const pushHistory = (h: IHistory, v: IState) => {
  return (h.next = {
    prev: h,
    value: v,
    next: null,
  });
};

const assert = (v: boolean, msg: string) => {
  if (!v) {
    throw new Error(msg);
  }
};

const update_selector = (
  e: React.ChangeEvent<HTMLInputElement>,
  i: number,
) => ({
  type: "update_selector" as const,
  i,
  selector: e.currentTarget.value,
});

const add_selector = () => ({
  type: "add_selector" as const,
});

function* expand_job_list(
  job_list: IJobText[],
  jobs_of_t: { [k: string]: IJobText[] },
  jobs_of_d: { [k: string]: IJobText[] },
  seen: Set<IJobText>,
  job_set_max: Set<IJobText>,
  upward: boolean,
  downward: boolean,
): Generator<IJobText, any, undefined> {
  for (const j of job_list) {
    if (job_set_max.has(j) && !seen.has(j)) {
      seen.add(j);
      yield j;
      if (upward) {
        for (const t of j.ts) {
          if (t in jobs_of_d) {
            yield* expand_job_list(
              jobs_of_d[t],
              jobs_of_t,
              jobs_of_d,
              seen,
              job_set_max,
              true,
              false,
            );
          }
        }
      }
      if (downward) {
        for (const d of j.ds) {
          yield* expand_job_list(
            jobs_of_t[d],
            jobs_of_t,
            jobs_of_d,
            seen,
            job_set_max,
            false,
            true,
          );
        }
      }
    }
  }
}

const filter_job_list = (state: IState) => {
  let job_list = state.job_list;
  for (const selector of state.selector_list) {
    const ws = selector.split(SPACES_RE);
    job_list = Array.from(
      expand_job_list(
        job_list.filter(j => ws.every(w => j.text.includes(w))),
        state.jobs_of_t,
        state.jobs_of_d,
        new Set(),
        new Set(job_list),
        true,
        true,
      ),
    );
  }
  return job_list;
};

const Display = connect((state: IState) => {
  return {
    job_list: filter_job_list(state),
  };
})((props: { job_list: IJobText[] }) => (
  <div id="display">
    <ol>
      {props.job_list.map(j => (
        <li key={j.text}>{j.text}</li>
      ))}
    </ol>
  </div>
));

const Selector = connect(
  (
    state: IState,
    ownProps: {
      i: number;
    },
  ) => ({ selector: state.selector_list[ownProps.i] }),
  (
    dispatch: Dispatch<TActions>,
    ownProps: {
      i: number;
    },
  ) => ({
    update_selector: (e: React.ChangeEvent<HTMLInputElement>) =>
      dispatch(update_selector(e, ownProps.i)),
  }),
)(
  (props: {
    selector: string;
    update_selector: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => {
    return (
      <input
        className="selector"
        value={props.selector}
        onChange={e => props.update_selector(e)}
      />
    );
  },
);

const Selectors = connect(
  (state: IState) => ({
    n_selector_list: state.selector_list.length,
  }),
  (dispatch: Dispatch<TActions>) => ({
    add_selector: () => dispatch(add_selector()),
  }),
)((props: { n_selector_list: number; add_selector: () => void }) => (
  <div id="selectors">
    <button onClick={props.add_selector}>+</button>
    <ol>
      {[...Array(props.n_selector_list).keys()].map(i => (
        <li key={i}>
          <Selector i={i} />
        </li>
      ))}
    </ol>
  </div>
));

const App = () => (
  <React.Fragment>
    <Selectors />
    <Display />
  </React.Fragment>
);

const root_reducer_of = (state_: IState) => {
  return (state: undefined | IState, action: TActions) => {
    if (state === undefined) {
      return state_;
    } else {
      switch (action.type) {
        case "add_selector":
          return produce(state, draft => {
            draft.selector_list.push("");
          });
        case "update_selector":
          return produce(state, draft => {
            draft.selector_list[action.i] = action.selector;
          });
        default:
          const _: never = action; // 1 or state cannot be used here
          return state;
      }
    }
  };
};

const run = (data: IJob[]) => {
  const job_list = data.map(j => ({
    ts: Array.from(new Set(iterate_string_container(j.ts))),
    ds: Array.from(new Set(iterate_string_container(j.ds))),
    text: JSON.stringify(j),
  }));
  const jobs_of_t = {} as {
    [k: string]: IJobText[];
  };
  const jobs_of_d = {} as {
    [k: string]: IJobText[];
  };
  for (const j of job_list) {
    for (const t of j.ts) {
      if (t in jobs_of_t) {
        jobs_of_t[t].push(j);
      } else {
        jobs_of_t[t] = [j];
      }
    }
    for (const d of j.ds) {
      if (d in jobs_of_d) {
        jobs_of_d[d].push(j);
      } else {
        jobs_of_d[d] = [j];
      }
    }
  }
  const state = {
    job_list,
    jobs_of_t,
    jobs_of_d,
    selector_list: [] as string[],
    save_success: true,
  };
  const store = createStore(root_reducer_of(state), state);
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
};

const main = () => {
  fetch("api/" + API_VERSION + "/get")
    .then(r => r.json())
    .then((data: IJob[]) => {
      ReactDOM.render(run(data), document.getElementById("root"));
    });
};

main();
