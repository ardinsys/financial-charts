<script setup lang="ts">
import {
  type MovingAverageIndicator,
  type MovingAverageOptions,
} from "@ardinsys/financial-charts";

const props = defineProps<{
  indicator?: MovingAverageIndicator;
}>();
const emit = defineEmits<{
  close: [];
}>();

const { copy } = useSiteLocale();
const titleId = `indicator-settings-${useId()}`;
const dialog = ref<HTMLDialogElement>();
const isClosing = ref(false);
const period = ref(9);
const source = ref<MovingAverageOptions["source"]>("close");

watch(
  () => props.indicator,
  async (indicator) => {
    if (!indicator) {
      dialog.value?.close();
      return;
    }

    const options = indicator.getOptions();
    isClosing.value = false;
    period.value = options.period;
    source.value = options.source;
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
  },
  { flush: "post" }
);

function close() {
  if (!dialog.value?.open || isClosing.value) return;
  isClosing.value = true;
}

function finishClose(event: AnimationEvent) {
  if (event.target !== dialog.value || !isClosing.value) return;
  dialog.value.close();
}

function apply() {
  const nextPeriod = Math.max(2, Math.min(50, Math.round(period.value)));
  period.value = nextPeriod;
  props.indicator?.updateOptions({
    period: nextPeriod,
    source: source.value,
  });
  close();
}

function closeFromBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close();
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      :class="['indicator-settings-dialog', { 'is-closing': isClosing }]"
      :aria-labelledby="titleId"
      @click="closeFromBackdrop"
      @cancel.prevent="close"
      @animationend="finishClose"
      @close="emit('close')"
    >
      <form method="dialog" @submit.prevent="apply">
        <header>
          <div>
            <span class="kicker">{{ copy.indicatorSettings.kicker }}</span>
            <h2 :id="titleId">{{ copy.indicatorSettings.title }}</h2>
          </div>
          <button
            class="dialog-close"
            type="button"
            :aria-label="copy.indicatorSettings.closeDialog"
            @click="close"
          >
            ×
          </button>
        </header>

        <div class="indicator-settings-fields">
          <label>
            <span>{{ copy.indicatorSettings.period }}</span>
            <small>{{ copy.indicatorSettings.periodHelp }}</small>
            <input v-model.number="period" type="number" min="2" max="50" />
          </label>

          <label>
            <span>{{ copy.indicatorSettings.source }}</span>
            <small>{{ copy.indicatorSettings.sourceHelp }}</small>
            <select v-model="source">
              <option value="open">{{ copy.indicatorSettings.open }}</option>
              <option value="high">{{ copy.indicatorSettings.high }}</option>
              <option value="low">{{ copy.indicatorSettings.low }}</option>
              <option value="close">
                {{ copy.indicatorSettings.sourceClose }}
              </option>
            </select>
          </label>
        </div>

        <footer>
          <button class="button button-ghost" type="button" @click="close">
            {{ copy.indicatorSettings.cancel }}
          </button>
          <button class="button button-primary" type="submit">
            {{ copy.indicatorSettings.apply }}
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>
