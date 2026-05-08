import { imageSourceChannel } from '../service/imageSourceChannel';

describe('imageSourceChannel', () => {
  beforeEach(() => {
    imageSourceChannel.cancel();
  });

  it('delivers the picked source to the pending listener and clears it', () => {
    const spy = jest.fn();
    imageSourceChannel.request(spy);
    expect(imageSourceChannel._hasPending()).toBe(true);

    imageSourceChannel.resolve('camera');
    expect(spy).toHaveBeenCalledWith('camera');
    expect(imageSourceChannel._hasPending()).toBe(false);
  });

  it('cancel() drops the pending listener without invoking it', () => {
    const spy = jest.fn();
    imageSourceChannel.request(spy);
    imageSourceChannel.cancel();
    expect(spy).not.toHaveBeenCalled();
    expect(imageSourceChannel._hasPending()).toBe(false);
  });

  it('a second request overrides the first — last caller wins', () => {
    const first = jest.fn();
    const second = jest.fn();
    imageSourceChannel.request(first);
    imageSourceChannel.request(second);
    imageSourceChannel.resolve('library');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('library');
  });

  it('resolve() is a no-op when no listener is pending', () => {
    expect(() => imageSourceChannel.resolve('camera')).not.toThrow();
  });
});
